import { ConflictError, NotFoundError } from "@/lib/errors";
import { nextResolution, type DisputeStatus, type DisputeType } from "./rules";

export interface DisputeRecord {
  id: string;
  booking_id: string;
  type: DisputeType;
  status: DisputeStatus;
  agreed_amount_minor: number | null;
  offer_minor: number | null;
}

export interface ResolveArgs {
  disputeId: string;
  resolution: "capture" | "refund" | "dismiss";
  amountMinor?: number;
  actorUserId: string;
  actorSide: "customer" | "provider" | "platform";
  note: string;
  refundPaymentId?: string;
}

/** Everything that touches money or the database, injected so the order of steps can be tested. */
export interface DisputePorts {
  getDispute(id: string): Promise<DisputeRecord | null>;
  /** Captures part of the held deposit with the payment provider. */
  capture(bookingId: string, amountMinor: number): Promise<void>;
  /** Refunds the renter through the payment provider and records it; null when the provider refused. */
  refund(bookingId: string, amountMinor: number, idempotencyKey: string): Promise<{ paymentId: string } | null>;
  /** The database step: records the outcome, captures in the ledger, and unfreezes the payout. */
  resolve(args: ResolveArgs): Promise<void>;
}

export interface Actor {
  actorUserId: string;
  actorSide: "customer" | "provider" | "platform";
  note: string;
}

/**
 * Settles a dispute. The provider step comes first (capture or refund) and the database record last,
 * so a provider failure leaves the dispute open for a retry; the refund key is per dispute, so a
 * retry after a database failure does not refund twice.
 */
export async function executeResolution(
  ports: DisputePorts,
  input: { disputeId: string; resolution: "capture" | "refund" | "dismiss"; amountMinor?: number } & Actor
): Promise<void> {
  const dispute = await ports.getDispute(input.disputeId);
  if (!dispute) throw new NotFoundError("Dispute not found.");
  if (dispute.status === "resolved" || dispute.status === "dismissed") throw new ConflictError("This dispute is already closed.");

  const base = { disputeId: dispute.id, actorUserId: input.actorUserId, actorSide: input.actorSide, note: input.note };

  if (input.resolution === "dismiss") {
    await ports.resolve({ ...base, resolution: "dismiss" });
    return;
  }
  if (!input.amountMinor || input.amountMinor <= 0) throw new ConflictError("An amount is needed to capture or refund.");

  if (input.resolution === "capture") {
    await ports.capture(dispute.booking_id, input.amountMinor);
    await ports.resolve({ ...base, resolution: "capture", amountMinor: input.amountMinor });
    return;
  }

  const refund = await ports.refund(dispute.booking_id, input.amountMinor, `dispute-refund:${dispute.id}`);
  if (!refund) throw new ConflictError("The refund could not be made. Nothing was changed; please try again.");
  await ports.resolve({ ...base, resolution: "refund", amountMinor: input.amountMinor, refundPaymentId: refund.paymentId });
}

/** After both sides agree on an amount: capture (provider claims) or refund (renter complaints) exactly that. */
export async function settleAgreed(ports: DisputePorts, disputeId: string, actor: Actor): Promise<void> {
  const dispute = await ports.getDispute(disputeId);
  if (!dispute) throw new NotFoundError("Dispute not found.");
  if (dispute.status !== "agreed") throw new ConflictError("This dispute has not been agreed.");

  const amount = dispute.agreed_amount_minor ?? 0;
  if (amount <= 0) return executeResolution(ports, { disputeId, resolution: "dismiss", ...actor });
  return executeResolution(ports, { disputeId, resolution: nextResolution(dispute.type), amountMinor: amount, ...actor });
}
