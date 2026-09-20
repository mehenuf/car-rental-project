import { beforeEach, describe, expect, it } from "vitest";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type { PaymentMethodCode } from "@/lib/payments/methods";
import type { ChargeRequest, PaymentProvider, ProviderResult, RefundRequest, RefundResult } from "@/lib/payments/provider";
import {
  cancelBooking,
  confirmCheckout,
  handleStripeEvent,
  captureDepositForBooking,
  refundAmount,
  releaseDueDeposits,
  startCheckout,
  type BookingForPayment,
  type NewPayment,
  type PaymentRecord,
  type PaymentsDeps,
  type PaymentsRepo,
} from "@/lib/payments/service";
import { SimulatedProvider } from "@/lib/payments/simulated-provider";

const NOW = new Date("2030-03-01T10:00:00Z");

const snapshot = {
  quote: {
    totalMinor: 20000,
    depositMinor: 30000,
    pickupAt: "2030-03-10T10:00:00.000Z",
    cancellationTiers: [
      { hoursBefore: 48, refundBp: 10000 },
      { hoursBefore: 24, refundBp: 5000 },
      { hoursBefore: 0, refundBp: 0 },
    ],
  },
};

/** An in-memory stand-in for the database that follows the same contracts as the SQL functions. */
class FakeRepo implements PaymentsRepo {
  bookings = new Map<string, BookingForPayment>();
  payments = new Map<string, PaymentRecord>();
  transitions: string[] = [];
  successCalls = 0;
  private seq = 0;

  addBooking(overrides: Partial<BookingForPayment> = {}): BookingForPayment {
    const booking: BookingForPayment = {
      id: "b1",
      reference: "BC-ABC123",
      status: "pending",
      payment_status: "unpaid",
      hold_expires_at: new Date(NOW.getTime() + 10 * 60_000).toISOString(),
      email: "a@example.com",
      currency: "USD",
      price_snapshot: snapshot,
      user_id: null,
      guest_id: "guest-1",
      country_code: "US",
      ...overrides,
    };
    this.bookings.set(booking.id, booking);
    return booking;
  }

  async getBookingByReference(reference: string) {
    return [...this.bookings.values()].find((b) => b.reference === reference) ?? null;
  }
  async getBooking(id: string) {
    return this.bookings.get(id) ?? null;
  }
  async getPayment(id: string) {
    return this.payments.get(id) ?? null;
  }
  async findPaymentByKey(key: string) {
    return [...this.payments.values()].find((p) => p.idempotency_key === key) ?? null;
  }
  async findPaymentByProviderRef(provider: string, ref: string) {
    return [...this.payments.values()].find((p) => p.provider === provider && p.provider_ref === ref) ?? null;
  }
  async listPayments(bookingId: string) {
    return [...this.payments.values()].filter((p) => p.booking_id === bookingId);
  }
  async insertPayment(p: NewPayment) {
    const existing = await this.findPaymentByKey(p.idempotency_key);
    if (existing) return existing;
    const row: PaymentRecord = { id: `p${++this.seq}`, provider_ref: null, failure_code: null, status: "processing", ...p };
    this.payments.set(row.id, row);
    return row;
  }
  async updatePayment(id: string, patch: Partial<Pick<PaymentRecord, "status" | "provider_ref" | "failure_code">>) {
    const row = { ...this.payments.get(id)!, ...patch };
    this.payments.set(id, row);
    return row;
  }
  async recordPaymentSuccess(id: string) {
    this.successCalls++;
    const pay = this.payments.get(id)!;
    const booking = this.bookings.get(pay.booking_id)!;
    if (pay.status === "succeeded") return { result: "already_recorded" };
    if (booking.status !== "pending") {
      this.payments.set(id, { ...pay, status: "failed", failure_code: "booking_unavailable" });
      return { result: "booking_unavailable" };
    }
    this.payments.set(id, { ...pay, status: "succeeded" });
    this.bookings.set(booking.id, { ...booking, status: "confirmed", payment_status: "paid" });
    return { result: "confirmed" };
  }
  async recordRefundSuccess(id: string) {
    const pay = this.payments.get(id)!;
    this.payments.set(id, { ...pay, status: "succeeded" });
    return { result: "recorded" };
  }
  async recordDepositHold(id: string) {
    this.payments.set(id, { ...this.payments.get(id)!, status: "succeeded" });
    return { result: "recorded" };
  }
  async releaseDepositRecord(id: string) {
    this.payments.set(id, { ...this.payments.get(id)!, status: "released" });
    return { result: "released" };
  }
  async transitionBooking(id: string, to: string) {
    this.transitions.push(to);
    const booking = this.bookings.get(id)!;
    this.bookings.set(id, { ...booking, status: to });
  }
  async dueDepositsToRelease() {
    return [...this.payments.values()].filter((p) => p.kind === "deposit_hold" && p.status === "succeeded");
  }
  byKind(kind: string) {
    return [...this.payments.values()].filter((p) => p.kind === kind);
  }
}

class SpyProvider extends SimulatedProvider implements PaymentProvider {
  charges = 0;
  refunds: RefundRequest[] = [];
  releases: string[] = [];
  captures: { providerRef: string; amountMinor: number }[] = [];
  refundResult: RefundResult | null = null;
  override async createCharge(request: ChargeRequest): Promise<ProviderResult> {
    this.charges++;
    return super.createCharge(request);
  }
  override async refund(request: RefundRequest): Promise<RefundResult> {
    this.refunds.push(request);
    return this.refundResult ?? super.refund(request);
  }
  override async releaseDeposit(providerRef: string): Promise<void> {
    this.releases.push(providerRef);
  }
  override async captureDeposit(providerRef: string, amountMinor: number): Promise<void> {
    this.captures.push({ providerRef, amountMinor });
  }
}

let repo: FakeRepo;
let provider: SpyProvider;
let deps: PaymentsDeps;
const identity = { userId: null, guestId: "guest-1" };

beforeEach(() => {
  repo = new FakeRepo();
  repo.addBooking();
  provider = new SpyProvider();
  deps = {
    repo,
    chargeProviderFor: () => provider,
    depositProvider: provider,
    providerByName: () => provider,
    now: () => NOW,
  };
});

const pay = (overrides: Partial<Parameters<typeof startCheckout>[1]> = {}) =>
  startCheckout(deps, { reference: "BC-ABC123", method: "card" as PaymentMethodCode, testInput: null, attempt: "a1", identity, ...overrides });

describe("startCheckout", () => {
  it("authorizes the deposit, charges, and confirms the booking", async () => {
    const result = await pay();
    expect(result.status).toBe("succeeded");
    expect(repo.successCalls).toBe(1);
    expect(repo.bookings.get("b1")).toMatchObject({ status: "confirmed", payment_status: "paid" });
    expect(repo.byKind("deposit_hold")[0]).toMatchObject({ status: "succeeded", amount_minor: 30000 });
    expect(repo.byKind("charge")[0]).toMatchObject({ amount_minor: 20000, currency: "USD", provider: "simulated" });
  });

  it("fails cleanly on a declined card and releases the deposit hold", async () => {
    const result = await pay({ testInput: "4000000000000002" });
    expect(result).toMatchObject({ status: "failed", failureCode: "card_declined" });
    expect(repo.successCalls).toBe(0);
    expect(repo.bookings.get("b1")?.payment_status).toBe("unpaid");
    expect(repo.byKind("deposit_hold")[0]?.status).toBe("released");
    expect(provider.releases).toHaveLength(1);
  });

  it("does not charge when the deposit cannot be authorized", async () => {
    const result = await pay({ testInput: "nodeposit" });
    expect(result).toMatchObject({ status: "failed", failureCode: "deposit_declined" });
    expect(provider.charges).toBe(0);
    expect(repo.byKind("charge")).toHaveLength(0);
  });

  it("returns requires_action, then completes with the confirmation code", async () => {
    const started = await pay({ testInput: "4000000000003220" });
    expect(started.status).toBe("requires_action");
    expect(repo.bookings.get("b1")?.payment_status).toBe("unpaid");

    const bad = await confirmCheckout(deps, { paymentId: started.paymentId, code: "111111", identity });
    expect(bad).toMatchObject({ status: "failed", failureCode: "authentication_failed" });
    expect(repo.byKind("deposit_hold")[0]?.status).toBe("released");
  });

  it("confirms an action-required payment with the right code", async () => {
    const started = await pay({ testInput: "4000000000003220" });
    const done = await confirmCheckout(deps, { paymentId: started.paymentId, code: "000000", identity });
    expect(done.status).toBe("succeeded");
    expect(repo.bookings.get("b1")).toMatchObject({ status: "confirmed", payment_status: "paid" });
  });

  it("is idempotent for the same attempt: one charge, one provider call", async () => {
    const first = await pay();
    const second = await pay();
    expect(second.paymentId).toBe(first.paymentId);
    expect(provider.charges).toBe(1);
    expect(repo.byKind("charge")).toHaveLength(1);
    expect(repo.successCalls).toBe(1);
  });

  it("refuses a booking the caller does not own, an expired hold, and an already paid booking", async () => {
    await expect(pay({ identity: { userId: null, guestId: "someone-else" } })).rejects.toBeInstanceOf(NotFoundError);
    await expect(pay({ reference: "BC-NOPE" })).rejects.toBeInstanceOf(NotFoundError);

    repo.addBooking({ hold_expires_at: new Date(NOW.getTime() - 1000).toISOString() });
    await expect(pay()).rejects.toBeInstanceOf(ConflictError);

    repo.addBooking({ payment_status: "paid", status: "confirmed" });
    await expect(pay()).rejects.toBeInstanceOf(ConflictError);
  });

  it("refuses a payment method that is not offered for the branch country and currency", async () => {
    await expect(pay({ method: "mpesa" })).rejects.toBeInstanceOf(ConflictError);
  });

  it("refunds in full when the booking was taken while the customer was paying", async () => {
    repo.recordPaymentSuccess = async (id: string) => {
      const p = repo.payments.get(id)!;
      repo.payments.set(id, { ...p, status: "failed", failure_code: "booking_unavailable" });
      return { result: "booking_unavailable" };
    };
    const result = await pay();
    expect(result).toMatchObject({ status: "failed", failureCode: "booking_unavailable" });
    expect(provider.refunds).toHaveLength(1);
    expect(provider.refunds[0]).toMatchObject({ amountMinor: 20000 });
  });
});

describe("cancelBooking", () => {
  async function paidBooking() {
    await pay();
    return repo.byKind("charge")[0]!;
  }

  it("refunds in full when a customer cancels early, and releases the deposit", async () => {
    await paidBooking();
    const result = await cancelBooking(deps, { bookingId: "b1", cancelledBy: "customer" });
    expect(result).toMatchObject({ refundMinor: 20000, refundStatus: "succeeded" });
    expect(repo.bookings.get("b1")?.status).toBe("cancelled");
    expect(repo.byKind("refund")[0]).toMatchObject({ amount_minor: 20000, status: "succeeded" });
    expect(repo.byKind("deposit_hold")[0]?.status).toBe("released");
  });

  it("applies the partial tier and refunds nothing inside the last window", async () => {
    await paidBooking();
    const late = { ...deps, now: () => new Date("2030-03-09T00:00:00Z") }; // 34h before
    const partial = await cancelBooking(late, { bookingId: "b1", cancelledBy: "customer" });
    expect(partial).toMatchObject({ refundMinor: 10000, refundBp: 5000 });

    repo.bookings.set("b1", { ...repo.bookings.get("b1")!, status: "confirmed" });
    const last = { ...deps, now: () => new Date("2030-03-10T08:00:00Z") };
    const none = await cancelBooking(last, { bookingId: "b1", cancelledBy: "customer" });
    expect(none.refundMinor).toBe(0);
  });

  it("refunds everything left when the provider cancels", async () => {
    await paidBooking();
    const late = { ...deps, now: () => new Date("2030-03-10T08:00:00Z") };
    const result = await cancelBooking(late, { bookingId: "b1", cancelledBy: "provider" });
    expect(result.refundMinor).toBe(20000);
  });

  it("only cancels an unpaid booking, with no refund", async () => {
    const result = await cancelBooking(deps, { bookingId: "b1", cancelledBy: "customer" });
    expect(result).toMatchObject({ refundMinor: 0, refundStatus: "none" });
    expect(repo.bookings.get("b1")?.status).toBe("cancelled");
  });

  it("reports a failed refund without pretending it worked", async () => {
    await paidBooking();
    provider.refundResult = { providerRef: "", status: "failed", failureCode: "processor_down" };
    const result = await cancelBooking(deps, { bookingId: "b1", cancelledBy: "customer" });
    expect(result.refundStatus).toBe("failed");
    expect(repo.byKind("refund")[0]?.status).toBe("failed");
  });

  it("rejects cancelling a booking that is already finished", async () => {
    repo.addBooking({ status: "completed", payment_status: "paid" });
    await expect(cancelBooking(deps, { bookingId: "b1", cancelledBy: "customer" })).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("handleStripeEvent", () => {
  it("records a successful charge once, and ignores unknown references", async () => {
    repo.payments.set("px", {
      id: "px", booking_id: "b1", kind: "charge", method: "card", provider: "stripe", provider_ref: "pi_1",
      status: "requires_action", amount_minor: 20000, currency: "USD", idempotency_key: "k", failure_code: null,
    });
    expect(await handleStripeEvent(deps, { kind: "charge_succeeded", providerRef: "pi_1", paymentId: "px" })).toBe("recorded");
    expect(await handleStripeEvent(deps, { kind: "charge_succeeded", providerRef: "pi_1", paymentId: "px" })).toBe("already_recorded");
    expect(await handleStripeEvent(deps, { kind: "charge_succeeded", providerRef: "pi_unknown", paymentId: null })).toBe("ignored");
    expect(await handleStripeEvent(deps, { kind: "ignored" })).toBe("ignored");
  });

  it("marks a failed charge and releases the held deposit", async () => {
    repo.payments.set("px", {
      id: "px", booking_id: "b1", kind: "charge", method: "card", provider: "stripe", provider_ref: "pi_2",
      status: "requires_action", amount_minor: 20000, currency: "USD", idempotency_key: "k", failure_code: null,
    });
    repo.payments.set("pd", {
      id: "pd", booking_id: "b1", kind: "deposit_hold", method: "card", provider: "simulated", provider_ref: "sim_dep_1",
      status: "succeeded", amount_minor: 30000, currency: "USD", idempotency_key: "kd", failure_code: null,
    });
    await handleStripeEvent(deps, { kind: "charge_failed", providerRef: "pi_2", paymentId: "px", failureCode: "card_declined" });
    expect(repo.payments.get("px")).toMatchObject({ status: "failed", failure_code: "card_declined" });
    expect(repo.payments.get("pd")?.status).toBe("released");
  });
});

describe("refundAmount", () => {
  it("refunds part of a paid booking through the provider and records it once", async () => {
    await pay();
    const first = await refundAmount(deps, { bookingId: "b1", amountMinor: 5000, idempotencyKey: "dispute-refund:d1" });
    expect(first).toEqual({ paymentId: expect.any(String) });
    expect(provider.refunds.at(-1)).toMatchObject({ amountMinor: 5000 });
    expect(repo.byKind("refund")[0]).toMatchObject({ amount_minor: 5000, status: "succeeded" });
    const again = await refundAmount(deps, { bookingId: "b1", amountMinor: 5000, idempotencyKey: "dispute-refund:d1" });
    expect(again?.paymentId).toBe(first?.paymentId);
    expect(repo.byKind("refund")).toHaveLength(1);
  });
  it("returns null when the provider refuses, leaving a failed payment", async () => {
    await pay();
    provider.refundResult = { providerRef: "", status: "failed", failureCode: "declined" } as RefundResult;
    expect(await refundAmount(deps, { bookingId: "b1", amountMinor: 5000, idempotencyKey: "k2" })).toBeNull();
    expect(repo.byKind("refund")[0]?.status).toBe("failed");
  });
  it("refuses an unpaid booking", async () => {
    repo.addBooking({ id: "b2", reference: "BC-NOPAY1" });
    await expect(refundAmount(deps, { bookingId: "b2", amountMinor: 100, idempotencyKey: "k3" })).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("captureDepositForBooking", () => {
  it("captures part of the held deposit with the provider", async () => {
    await pay();
    await captureDepositForBooking(deps, { bookingId: "b1", amountMinor: 4000 });
    expect(provider.captures).toEqual([{ providerRef: expect.any(String), amountMinor: 4000 }]);
  });
  it("needs a held deposit", async () => {
    repo.addBooking({ id: "b3", reference: "BC-NODEP1", payment_status: "paid", status: "completed" });
    await expect(captureDepositForBooking(deps, { bookingId: "b3", amountMinor: 100 })).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("releaseDueDeposits", () => {
  it("releases every deposit the repository says is due", async () => {
    await pay();
    const released = await releaseDueDeposits(deps);
    expect(released).toBe(1);
    expect(repo.byKind("deposit_hold")[0]?.status).toBe("released");
  });
});
