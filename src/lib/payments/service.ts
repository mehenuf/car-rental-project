import { ConflictError, NotFoundError } from "@/lib/errors";
import { isPaymentMethodCode, methodsFor, type PaymentMethodCode } from "@/lib/payments/methods";
import type { PaymentProvider, ProviderResult } from "@/lib/payments/provider";
import { computeRefund, type RefundSnapshot } from "@/lib/payments/refunds";
import type { StripeWebhookResult } from "@/lib/payments/stripe-webhook";
import type { QuoteLine } from "@/lib/pricing/types";

// ---------------------------------------------------------------
// Ports: what the service needs from the database and the clock
// ---------------------------------------------------------------

export interface BookingForPayment {
  id: string;
  reference: string;
  status: string;
  payment_status: string;
  hold_expires_at: string | null;
  email: string;
  currency: string | null;
  price_snapshot:
    | (RefundSnapshot & {
        quote: RefundSnapshot["quote"] & {
          depositMinor?: number;
          lines?: QuoteLine[];
          days?: number;
        };
      })
    | null;
  user_id: string | null;
  guest_id: string | null;
  /** Country of the pickup branch; decides which local payment methods are offered. */
  country_code: string | null;
}

export interface PaymentRecord {
  id: string;
  booking_id: string;
  kind: "charge" | "deposit_hold" | "refund";
  method: PaymentMethodCode;
  provider: "stripe" | "simulated";
  provider_ref: string | null;
  status: string;
  amount_minor: number;
  currency: string;
  idempotency_key: string;
  failure_code: string | null;
}

export type NewPayment = Pick<
  PaymentRecord,
  "booking_id" | "kind" | "method" | "provider" | "amount_minor" | "currency" | "idempotency_key"
>;

export interface PaymentsRepo {
  getBookingByReference(reference: string): Promise<BookingForPayment | null>;
  getBooking(id: string): Promise<BookingForPayment | null>;
  getPayment(id: string): Promise<PaymentRecord | null>;
  findPaymentByKey(key: string): Promise<PaymentRecord | null>;
  findPaymentByProviderRef(provider: string, providerRef: string): Promise<PaymentRecord | null>;
  listPayments(bookingId: string): Promise<PaymentRecord[]>;
  /** Idempotent on `idempotency_key`: returns the existing row when the key was already used. */
  insertPayment(payment: NewPayment): Promise<PaymentRecord>;
  updatePayment(
    id: string,
    patch: Partial<Pick<PaymentRecord, "status" | "provider_ref" | "failure_code">>
  ): Promise<PaymentRecord>;
  recordPaymentSuccess(paymentId: string): Promise<{ result: string }>;
  recordRefundSuccess(paymentId: string): Promise<{ result: string }>;
  recordDepositHold(paymentId: string): Promise<{ result: string }>;
  releaseDepositRecord(paymentId: string): Promise<{ result: string }>;
  transitionBooking(bookingId: string, to: string): Promise<void>;
  dueDepositsToRelease(now: Date): Promise<PaymentRecord[]>;
}

export interface PaymentsDeps {
  repo: PaymentsRepo;
  chargeProviderFor(method: PaymentMethodCode): PaymentProvider;
  depositProvider: PaymentProvider;
  providerByName(name: "stripe" | "simulated"): PaymentProvider;
  now(): Date;
}

export interface Identity {
  userId: string | null;
  guestId: string | null;
}

export type CheckoutStatus = "succeeded" | "requires_action" | "processing" | "failed";

export interface CheckoutResult {
  paymentId: string;
  status: CheckoutStatus;
  failureCode?: string;
  /** Stripe only: the browser confirms the payment with this secret. */
  clientSecret?: string;
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function canAccess(booking: BookingForPayment, identity: Identity): boolean {
  return (
    (booking.user_id !== null && booking.user_id === identity.userId) ||
    (booking.guest_id !== null && booking.guest_id === identity.guestId)
  );
}

function toCheckoutStatus(status: string): CheckoutStatus {
  return status === "succeeded" || status === "requires_action" || status === "processing" ? status : "failed";
}

/** Releases every deposit hold still active on a booking (after a failed payment or a cancellation). */
async function releaseHeldDeposits(deps: PaymentsDeps, bookingId: string): Promise<void> {
  for (const payment of await deps.repo.listPayments(bookingId)) {
    if (payment.kind === "deposit_hold" && payment.status === "succeeded") {
      await deps.depositProvider.releaseDeposit(payment.provider_ref ?? "");
      await deps.repo.releaseDepositRecord(payment.id);
    }
  }
}

/** Applies a provider's answer to a charge: confirms the booking, or records the failure. */
async function settleCharge(
  deps: PaymentsDeps,
  booking: BookingForPayment,
  payment: PaymentRecord,
  result: ProviderResult,
  provider: PaymentProvider
): Promise<CheckoutResult> {
  await deps.repo.updatePayment(payment.id, { provider_ref: result.providerRef });

  if (result.status === "succeeded") {
    const recorded = await deps.repo.recordPaymentSuccess(payment.id);
    if (recorded.result === "booking_unavailable") {
      // The booking was lost while the customer was paying: give the money back and say so.
      await provider.refund({
        providerRef: result.providerRef,
        amountMinor: payment.amount_minor,
        currency: payment.currency,
        idempotencyKey: `refund:${payment.id}:unavailable`,
      });
      await releaseHeldDeposits(deps, booking.id);
      return { paymentId: payment.id, status: "failed", failureCode: "booking_unavailable" };
    }
    return { paymentId: payment.id, status: "succeeded" };
  }

  if (result.status === "failed") {
    await deps.repo.updatePayment(payment.id, { status: "failed", failure_code: result.failureCode ?? "payment_failed" });
    await releaseHeldDeposits(deps, booking.id);
    return { paymentId: payment.id, status: "failed", failureCode: result.failureCode ?? "payment_failed" };
  }

  await deps.repo.updatePayment(payment.id, { status: result.status });
  return { paymentId: payment.id, status: result.status, clientSecret: result.clientSecret };
}

// ---------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------

export interface StartCheckoutInput {
  reference: string;
  method: PaymentMethodCode;
  /** Simulated provider only: what the tester typed (card number or keyword). */
  testInput: string | null;
  /** Identifies one submit of the payment form; replaying it never double-charges. */
  attempt: string;
  identity: Identity;
}

/**
 * Pays for a pending booking: authorizes the security deposit first (no money
 * moves), then charges. A failed charge releases the deposit hold. Every step
 * is keyed by the booking and the attempt, so a repeated request replays the
 * stored result instead of calling the provider again.
 */
export async function startCheckout(deps: PaymentsDeps, input: StartCheckoutInput): Promise<CheckoutResult> {
  const { repo } = deps;
  const booking = await repo.getBookingByReference(input.reference);
  if (!booking || !canAccess(booking, input.identity)) throw new NotFoundError("Booking not found.");

  const base = `checkout:${booking.id}:${input.attempt}`;
  const chargeKey = `${base}:charge`;

  const replay = await repo.findPaymentByKey(chargeKey);
  if (replay) {
    return {
      paymentId: replay.id,
      status: toCheckoutStatus(replay.status),
      failureCode: replay.failure_code ?? undefined,
    };
  }

  if (booking.status !== "pending" || booking.payment_status !== "unpaid") {
    throw new ConflictError("This booking cannot be paid.");
  }
  if (booking.hold_expires_at && new Date(booking.hold_expires_at) <= deps.now()) {
    throw new ConflictError("Your booking hold has expired. Please start a new booking.");
  }
  const snapshot = booking.price_snapshot;
  if (!snapshot || !booking.currency) throw new ConflictError("This booking cannot be paid online.");
  if (!isPaymentMethodCode(input.method) || !methodsFor(booking.country_code ?? "", booking.currency).some((m) => m.code === input.method)) {
    throw new ConflictError("This payment method is not available for this booking.");
  }

  const provider = deps.chargeProviderFor(input.method);
  const requestBase = {
    currency: booking.currency,
    method: input.method,
    description: `Booking ${booking.reference}`,
    customerEmail: booking.email,
    testInput: input.testInput,
  };

  // 1. Deposit authorization (no money moves).
  const depositMinor = snapshot.quote.depositMinor ?? 0;
  if (depositMinor > 0) {
    const deposit = await repo.insertPayment({
      booking_id: booking.id,
      kind: "deposit_hold",
      method: input.method,
      provider: deps.depositProvider.name,
      amount_minor: depositMinor,
      currency: booking.currency,
      idempotency_key: `${base}:deposit`,
    });
    const held = await deps.depositProvider.authorizeDeposit({
      ...requestBase,
      paymentId: deposit.id,
      amountMinor: depositMinor,
      idempotencyKey: deposit.idempotency_key,
    });
    await repo.updatePayment(deposit.id, { provider_ref: held.providerRef });
    if (held.status === "failed") {
      await repo.updatePayment(deposit.id, { status: "failed", failure_code: held.failureCode ?? "deposit_declined" });
      return { paymentId: deposit.id, status: "failed", failureCode: held.failureCode ?? "deposit_declined" };
    }
    await repo.recordDepositHold(deposit.id);
  }

  // 2. The charge.
  const charge = await repo.insertPayment({
    booking_id: booking.id,
    kind: "charge",
    method: input.method,
    provider: provider.name,
    amount_minor: snapshot.quote.totalMinor,
    currency: booking.currency,
    idempotency_key: chargeKey,
  });
  const result = await provider.createCharge({
    ...requestBase,
    paymentId: charge.id,
    amountMinor: charge.amount_minor,
    idempotencyKey: chargeKey,
  });
  return settleCharge(deps, booking, charge, result, provider);
}

export interface ConfirmCheckoutInput {
  paymentId: string;
  /** The authentication code the tester enters for a simulated payment that asked for one. */
  code: string | null;
  identity: Identity;
}

/** Completes a simulated payment that returned `requires_action`. */
export async function confirmCheckout(deps: PaymentsDeps, input: ConfirmCheckoutInput): Promise<CheckoutResult> {
  const payment = await deps.repo.getPayment(input.paymentId);
  const booking = payment ? await deps.repo.getBooking(payment.booking_id) : null;
  if (!payment || !booking || payment.kind !== "charge" || !canAccess(booking, input.identity)) {
    throw new NotFoundError("Payment not found.");
  }
  if (payment.status !== "requires_action") {
    return { paymentId: payment.id, status: toCheckoutStatus(payment.status), failureCode: payment.failure_code ?? undefined };
  }
  if (payment.provider !== "simulated") {
    throw new ConflictError("This payment is confirmed with your card issuer, not here.");
  }

  const provider = deps.providerByName(payment.provider);
  const result = await provider.confirmCharge(payment.provider_ref ?? "", { code: input.code });
  return settleCharge(deps, booking, payment, result, provider);
}

// ---------------------------------------------------------------
// Cancellation and refunds
// ---------------------------------------------------------------

export interface CancelBookingInput {
  bookingId: string;
  /** A customer's refund follows the cancellation tiers; a provider or admin cancellation refunds everything. */
  cancelledBy: "customer" | "provider" | "admin";
}

export interface CancelBookingResult {
  refundMinor: number;
  refundBp: number;
  refundStatus: "none" | "succeeded" | "failed";
}

export async function cancelBooking(deps: PaymentsDeps, input: CancelBookingInput): Promise<CancelBookingResult> {
  const { repo } = deps;
  const booking = await repo.getBooking(input.bookingId);
  if (!booking) throw new NotFoundError("Booking not found.");
  if (booking.status !== "pending" && booking.status !== "confirmed") {
    throw new ConflictError("This booking can no longer be cancelled.");
  }

  await repo.transitionBooking(booking.id, "cancelled");

  const payments = await repo.listPayments(booking.id);
  const charge = payments.find((p) => p.kind === "charge" && p.status === "succeeded");
  const refunds = payments.filter((p) => p.kind === "refund");
  const alreadyRefunded = refunds.filter((p) => p.status === "succeeded").reduce((sum, p) => sum + p.amount_minor, 0);

  let outcome: CancelBookingResult = { refundMinor: 0, refundBp: 0, refundStatus: "none" };
  if (charge && booking.price_snapshot && (booking.payment_status === "paid" || booking.payment_status === "partially_refunded")) {
    const decision = computeRefund(booking.price_snapshot, deps.now(), alreadyRefunded, { full: input.cancelledBy !== "customer" });
    outcome = { refundMinor: decision.refundMinor, refundBp: decision.refundBp, refundStatus: "none" };

    if (decision.refundMinor > 0) {
      const provider = deps.providerByName(charge.provider);
      const refund = await repo.insertPayment({
        booking_id: booking.id,
        kind: "refund",
        method: charge.method,
        provider: charge.provider,
        amount_minor: decision.refundMinor,
        currency: charge.currency,
        idempotency_key: `refund:${booking.id}:${refunds.length + 1}`,
      });
      const result = await provider.refund({
        providerRef: charge.provider_ref ?? "",
        amountMinor: decision.refundMinor,
        currency: charge.currency,
        idempotencyKey: refund.idempotency_key,
      });
      if (result.status === "succeeded") {
        await repo.updatePayment(refund.id, { provider_ref: result.providerRef });
        await repo.recordRefundSuccess(refund.id);
        outcome.refundStatus = "succeeded";
      } else {
        await repo.updatePayment(refund.id, { status: "failed", failure_code: result.failureCode ?? "refund_failed" });
        outcome.refundStatus = "failed";
      }
    }
  }

  await releaseHeldDeposits(deps, booking.id);
  return outcome;
}

/**
 * Refunds part of a paid booking (for example after a dispute is decided in the renter's favour).
 * Keyed, so repeating the call returns the same refund. Null when the provider refuses.
 */
export async function refundAmount(
  deps: PaymentsDeps,
  input: { bookingId: string; amountMinor: number; idempotencyKey: string }
): Promise<{ paymentId: string } | null> {
  const { repo } = deps;
  const existing = await repo.findPaymentByKey(input.idempotencyKey);
  if (existing) return existing.status === "succeeded" ? { paymentId: existing.id } : null;

  const payments = await repo.listPayments(input.bookingId);
  const charge = payments.find((p) => p.kind === "charge" && p.status === "succeeded");
  if (!charge) throw new ConflictError("This booking has no payment to refund.");

  const refund = await repo.insertPayment({
    booking_id: input.bookingId,
    kind: "refund",
    method: charge.method,
    provider: charge.provider,
    amount_minor: input.amountMinor,
    currency: charge.currency,
    idempotency_key: input.idempotencyKey,
  });
  const result = await deps.providerByName(charge.provider).refund({
    providerRef: charge.provider_ref ?? "",
    amountMinor: input.amountMinor,
    currency: charge.currency,
    idempotencyKey: input.idempotencyKey,
  });
  if (result.status !== "succeeded") {
    await repo.updatePayment(refund.id, { status: "failed", failure_code: result.failureCode ?? "refund_failed" });
    return null;
  }
  await repo.updatePayment(refund.id, { provider_ref: result.providerRef });
  await repo.recordRefundSuccess(refund.id);
  return { paymentId: refund.id };
}

/** Captures part of the held security deposit with the payment provider (the ledger entry is made by the database step). */
export async function captureDepositForBooking(
  deps: PaymentsDeps,
  input: { bookingId: string; amountMinor: number }
): Promise<void> {
  const payments = await deps.repo.listPayments(input.bookingId);
  const deposit = payments.find((p) => p.kind === "deposit_hold" && p.status === "succeeded");
  if (!deposit) throw new ConflictError("There is no held deposit to capture.");
  await deps.providerByName(deposit.provider).captureDeposit(deposit.provider_ref ?? "", input.amountMinor);
}

// ---------------------------------------------------------------
// Webhooks and scheduled work
// ---------------------------------------------------------------

/** Applies a verified Stripe event. Idempotent: Stripe retries, and so may we. */
export async function handleStripeEvent(
  deps: PaymentsDeps,
  event: StripeWebhookResult
): Promise<"recorded" | "already_recorded" | "ignored"> {
  if (event.kind === "ignored") return "ignored";

  const payment = event.paymentId
    ? await deps.repo.getPayment(event.paymentId)
    : await deps.repo.findPaymentByProviderRef("stripe", event.providerRef);
  if (!payment || payment.kind !== "charge") return "ignored";

  if (event.kind === "charge_succeeded") {
    const recorded = await deps.repo.recordPaymentSuccess(payment.id);
    if (recorded.result === "already_recorded") return "already_recorded";
    if (recorded.result === "booking_unavailable") {
      await deps.providerByName("stripe").refund({
        providerRef: event.providerRef,
        amountMinor: payment.amount_minor,
        currency: payment.currency,
        idempotencyKey: `refund:${payment.id}:unavailable`,
      });
      await releaseHeldDeposits(deps, payment.booking_id);
    }
    return "recorded";
  }

  if (payment.status !== "succeeded") {
    await deps.repo.updatePayment(payment.id, { status: "failed", failure_code: event.failureCode });
    await releaseHeldDeposits(deps, payment.booking_id);
  }
  return "recorded";
}

/** Releases deposits whose booking finished and whose dispute window has passed. */
export async function releaseDueDeposits(deps: PaymentsDeps): Promise<number> {
  const due = await deps.repo.dueDepositsToRelease(deps.now());
  for (const deposit of due) {
    await deps.depositProvider.releaseDeposit(deposit.provider_ref ?? "");
    await deps.repo.releaseDepositRecord(deposit.id);
  }
  return due.length;
}
