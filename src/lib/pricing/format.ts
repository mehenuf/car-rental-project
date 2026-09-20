import type { CancellationTier } from "@/lib/pricing/types";

function hours(n: number): string {
  return `${n} hour${n === 1 ? "" : "s"}`;
}

/** Plain-language cancellation terms for the booking panel, earliest deadline first. */
export function describeCancellation(tiers: CancellationTier[]): string[] {
  if (tiers.length === 0) return ["Cancellation terms are set by the rental company."];

  const sorted = [...tiers].sort((a, b) => b.hoursBefore - a.hoursBefore);
  const lines: string[] = [];
  for (const tier of sorted) {
    if (tier.hoursBefore === 0 && tier.refundBp === 0) {
      lines.push("No refund after that");
    } else if (tier.refundBp >= 10000) {
      lines.push(`Free cancellation up to ${hours(tier.hoursBefore)} before pick-up`);
    } else if (tier.refundBp > 0) {
      lines.push(`${Math.round(tier.refundBp / 100)}% refund up to ${hours(tier.hoursBefore)} before pick-up`);
    } else {
      lines.push(`No refund within ${hours(tier.hoursBefore)} of pick-up`);
    }
  }
  return lines;
}
