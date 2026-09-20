import "server-only";
import { ConflictError } from "@/lib/errors";
import { toBookingApiError } from "@/lib/booking-errors";
import type {
  BookingForPayment,
  NewPayment,
  PaymentRecord,
  PaymentsRepo,
} from "@/lib/payments/service";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { Json, PaymentRow } from "@/types/database";

const DISPUTE_WINDOW_HOURS = 48;

function toRecord(row: PaymentRow): PaymentRecord {
  return {
    id: row.id,
    booking_id: row.booking_id,
    kind: row.kind,
    method: row.method,
    provider: row.provider,
    provider_ref: row.provider_ref,
    status: row.status,
    amount_minor: row.amount_minor,
    currency: row.currency,
    idempotency_key: row.idempotency_key,
    failure_code: row.failure_code,
  };
}

/** Domain problems raised by the payment SQL functions (BP003 to BP005) surface as 409s; anything else is a 500. */
function fail(context: string, error: { code?: string; message: string }): never {
  if (error.code === "BP003" || error.code === "BP004" || error.code === "BP005") {
    throw new ConflictError(error.message);
  }
  throw new Error(`${context}: ${error.message}`);
}

function resultOf(data: Json | null): { result: string } {
  const result = (data as { result?: unknown } | null)?.result;
  return { result: typeof result === "string" ? result : "unknown" };
}

async function loadBooking(column: "id" | "reference", value: string): Promise<BookingForPayment | null> {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("id, reference, status, payment_status, hold_expires_at, email, currency, price_snapshot, user_id, guest_id, pickup_branch_id")
    .eq(column, value)
    .maybeSingle();
  if (error) throw new Error(`payments repo (booking): ${error.message}`);
  if (!data) return null;

  let countryCode: string | null = null;
  if (data.pickup_branch_id) {
    const { data: branch, error: branchError } = await supabaseAdmin
      .from("branches")
      .select("country_code")
      .eq("id", data.pickup_branch_id)
      .maybeSingle();
    if (branchError) throw new Error(`payments repo (branch): ${branchError.message}`);
    countryCode = branch?.country_code ?? null;
  }

  return {
    id: data.id,
    reference: data.reference,
    status: data.status,
    payment_status: data.payment_status,
    hold_expires_at: data.hold_expires_at,
    email: data.email,
    currency: data.currency,
    price_snapshot: data.price_snapshot as BookingForPayment["price_snapshot"],
    user_id: data.user_id,
    guest_id: data.guest_id,
    country_code: countryCode,
  };
}

export const paymentsRepo: PaymentsRepo = {
  getBookingByReference: (reference) => loadBooking("reference", reference),
  getBooking: (id) => loadBooking("id", id),

  async getPayment(id) {
    const { data, error } = await supabaseAdmin.from("payments").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`payments repo (getPayment): ${error.message}`);
    return data ? toRecord(data) : null;
  },

  async findPaymentByKey(key) {
    const { data, error } = await supabaseAdmin.from("payments").select("*").eq("idempotency_key", key).maybeSingle();
    if (error) throw new Error(`payments repo (findPaymentByKey): ${error.message}`);
    return data ? toRecord(data) : null;
  },

  async findPaymentByProviderRef(provider, providerRef) {
    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("provider", provider as "stripe" | "simulated")
      .eq("provider_ref", providerRef)
      .maybeSingle();
    if (error) throw new Error(`payments repo (findPaymentByProviderRef): ${error.message}`);
    return data ? toRecord(data) : null;
  },

  async listPayments(bookingId) {
    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`payments repo (listPayments): ${error.message}`);
    return (data ?? []).map(toRecord);
  },

  async insertPayment(payment: NewPayment) {
    const { data, error } = await supabaseAdmin.from("payments").insert(payment).select("*").single();
    if (error) {
      // A concurrent request already used this idempotency key: return its row instead of failing.
      if (error.code === "23505") {
        const existing = await paymentsRepo.findPaymentByKey(payment.idempotency_key);
        if (existing) return existing;
      }
      throw new Error(`payments repo (insertPayment): ${error.message}`);
    }
    return toRecord(data);
  },

  async updatePayment(id, patch) {
    const { data, error } = await supabaseAdmin
      .from("payments")
      .update({ ...patch, updated_at: new Date().toISOString() } as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(`payments repo (updatePayment): ${error.message}`);
    return toRecord(data);
  },

  async recordPaymentSuccess(paymentId) {
    const { data, error } = await supabaseAdmin.rpc("record_payment_success", { p_payment_id: paymentId });
    if (error) fail("record_payment_success", error);
    return resultOf(data);
  },

  async recordRefundSuccess(paymentId) {
    const { data, error } = await supabaseAdmin.rpc("record_refund_success", { p_payment_id: paymentId });
    if (error) fail("record_refund_success", error);
    return resultOf(data);
  },

  async recordDepositHold(paymentId) {
    const { data, error } = await supabaseAdmin.rpc("record_deposit_hold", { p_payment_id: paymentId });
    if (error) fail("record_deposit_hold", error);
    return resultOf(data);
  },

  async releaseDepositRecord(paymentId) {
    const { data, error } = await supabaseAdmin.rpc("release_deposit", { p_payment_id: paymentId });
    if (error) fail("release_deposit", error);
    return resultOf(data);
  },

  async transitionBooking(bookingId, to) {
    const { error } = await supabaseAdmin.rpc("transition_booking", {
      p_booking_id: bookingId,
      p_to: to as "cancelled",
    });
    if (error) throw toBookingApiError(error, "transitionBooking");
  },

  /** Held deposits of bookings that completed more than the dispute window ago. */
  async dueDepositsToRelease(now) {
    const cutoff = new Date(now.getTime() - DISPUTE_WINDOW_HOURS * 3_600_000).toISOString();
    const { data: deposits, error } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("kind", "deposit_hold")
      .eq("status", "succeeded");
    if (error) throw new Error(`payments repo (dueDeposits): ${error.message}`);
    if (!deposits || deposits.length === 0) return [];

    const { data: bookings, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .in("id", deposits.map((d) => d.booking_id))
      .eq("status", "completed")
      .lte("completed_at", cutoff);
    if (bookingError) throw new Error(`payments repo (dueDeposits): ${bookingError.message}`);

    const due = new Set((bookings ?? []).map((b) => b.id));
    if (due.size === 0) return [];

    // A deposit stays held while a dispute about the booking is unresolved.
    const { data: open, error: disputeError } = await supabaseAdmin
      .from("disputes")
      .select("booking_id")
      .in("booking_id", [...due])
      .not("status", "in", "(resolved,dismissed)");
    if (disputeError) throw new Error(`payments repo (dueDeposits): ${disputeError.message}`);
    for (const d of open ?? []) due.delete(d.booking_id);

    return deposits.filter((d) => due.has(d.booking_id)).map(toRecord);
  },
};
