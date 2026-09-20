import { mulBp } from "@/lib/pricing/money";
import type { CancellationTier } from "@/lib/pricing/types";

export interface RefundSnapshot {
  quote: {
    totalMinor: number;
    pickupAt: string;
    cancellationTiers: CancellationTier[];
  };
}

export interface RefundDecision {
  refundMinor: number;
  refundBp: number;
  /** The tier that applied, or null when none did (after pick-up, or no tiers). */
  tierHoursBefore: number | null;
  hoursUntilPickup: number;
}

/**
 * How much of a booking to refund if it is cancelled at `cancelAt`, from the
 * cancellation policy frozen in the booking's price snapshot. A tier applies
 * when the cancellation is at least `hoursBefore` hours before pick-up; the
 * earliest matching tier wins. `full` is for cancellations that are not the
 * customer's choice (provider cancels, admin override).
 */
export function computeRefund(
  snapshot: RefundSnapshot,
  cancelAt: Date,
  alreadyRefundedMinor = 0,
  options: { full?: boolean } = {}
): RefundDecision {
  const { totalMinor, pickupAt, cancellationTiers } = snapshot.quote;
  const hoursUntilPickup = (new Date(pickupAt).getTime() - cancelAt.getTime()) / 3_600_000;

  const tier = [...cancellationTiers]
    .sort((a, b) => b.hoursBefore - a.hoursBefore)
    .find((t) => hoursUntilPickup >= t.hoursBefore);

  const remaining = Math.max(0, totalMinor - alreadyRefundedMinor);
  const bp = options.full ? 10000 : (tier?.refundBp ?? 0);
  const refundMinor = options.full ? remaining : Math.min(mulBp(totalMinor, bp), remaining);

  return { refundMinor, refundBp: bp, tierHoursBefore: tier?.hoursBefore ?? null, hoursUntilPickup };
}
