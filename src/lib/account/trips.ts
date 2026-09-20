import "server-only";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { BookingRow } from "@/types/database";

export interface TripDetails {
  booking: BookingRow & { vehicle: { name: string; image_url: string | null } | null };
  /** Revealed only once the booking is paid. */
  pickup: { branchName: string; city: string; address: string | null } | null;
  provider: { displayName: string; phone: string | null } | null;
  receipt: { number: string } | null;
}

const PAID = new Set(["paid", "partially_refunded"]);

/** One of the signed-in customer's own bookings, with the private details unlocked only after payment. */
export async function getTrip(userId: string, reference: string): Promise<TripDetails | null> {
  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .select("*, vehicle:vehicles(name, image_url)")
    .eq("reference", reference)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`getTrip: ${error.message}`);
  if (!booking) return null;

  let pickup: TripDetails["pickup"] = null;
  let provider: TripDetails["provider"] = null;
  let receipt: TripDetails["receipt"] = null;

  if (PAID.has(booking.payment_status)) {
    const [{ data: branch }, { data: privateRow }, { data: prov }, { data: charge }] = await Promise.all([
      booking.pickup_branch_id
        ? supabaseAdmin.from("branches").select("name, city").eq("id", booking.pickup_branch_id).maybeSingle()
        : Promise.resolve({ data: null }),
      booking.pickup_branch_id
        ? supabaseAdmin.from("branch_private").select("address").eq("branch_id", booking.pickup_branch_id).maybeSingle()
        : Promise.resolve({ data: null }),
      booking.provider_id
        ? supabaseAdmin.from("providers").select("display_name, contact_phone").eq("id", booking.provider_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseAdmin
        .from("payments")
        .select("id")
        .eq("booking_id", booking.id)
        .eq("kind", "charge")
        .eq("status", "succeeded")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    if (branch) pickup = { branchName: branch.name, city: branch.city, address: privateRow?.address ?? null };
    if (prov) provider = { displayName: prov.display_name, phone: prov.contact_phone ?? null };
    if (charge) {
      const { data: issued, error: receiptError } = await supabaseAdmin.rpc("issue_receipt", { p_payment_id: charge.id });
      if (receiptError) throw new Error(`issue_receipt: ${receiptError.message}`);
      receipt = { number: issued.number };
    }
  }

  return { booking: booking as TripDetails["booking"], pickup, provider, receipt };
}

/** A receipt, only for its owner. */
export async function getReceipt(userId: string, number: string) {
  const { data, error } = await supabaseAdmin
    .from("receipts")
    .select("number, issued_at, snapshot, booking:bookings!inner(user_id)")
    .eq("number", number)
    .eq("booking.user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`getReceipt: ${error.message}`);
  return data;
}

/** How many guest bookings made with this verified email could be attached to the account. */
export async function countClaimable(email: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .is("user_id", null)
    .ilike("email", email.replace(/[\\%_]/g, "\\$&"));
  if (error) throw new Error(`countClaimable: ${error.message}`);
  return count ?? 0;
}
