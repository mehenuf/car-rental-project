import type { TFunction } from "@/lib/i18n/t";
import type { CancellationTier, QuoteLine } from "./types";

/**
 * The engine writes English line labels. Standard lines are re-labelled in the visitor's language
 * from their kind; provider-defined names (extras, insurance, tax rules, custom fees) are shown as
 * the provider entered them.
 */
export function quoteLineLabel(line: QuoteLine, days: number, t: TFunction): string {
  switch (line.kind) {
    case "base":
      return t("quote.base", { count: days });
    case "season":
      return t("quote.season");
    case "weekend":
      return t("quote.weekend");
    case "duration_discount":
      return t(days >= 28 ? "quote.monthly" : "quote.weekly");
    case "promo":
      return t("quote.promo", { code: line.code ?? "" });
    case "young_driver":
      return t("quote.youngDriver", { count: days });
    case "one_way":
      return t("quote.oneWay");
    case "pickup_surcharge":
      return t("quote.pickupSurcharge");
    case "service_fee":
      return t("quote.serviceFee");
    case "tax":
      if (line.included && line.label.endsWith(" (included)")) {
        return t("quote.taxIncluded", { name: line.label.slice(0, -" (included)".length) });
      }
      return line.label;
    default:
      return line.label;
  }
}

/** Plain-language cancellation terms, earliest deadline first, in the visitor's language. */
export function describeCancellationT(tiers: CancellationTier[], t: TFunction): string[] {
  if (tiers.length === 0) return [t("quote.cancelTerms")];

  const hours = (n: number) => t("quote.hours", { count: n });
  return [...tiers]
    .sort((a, b) => b.hoursBefore - a.hoursBefore)
    .map((tier) => {
      if (tier.hoursBefore === 0 && tier.refundBp === 0) return t("quote.cancelNoRefundAfter");
      if (tier.refundBp >= 10000) return t("quote.cancelFree", { hours: hours(tier.hoursBefore) });
      if (tier.refundBp > 0) {
        return t("quote.cancelPartial", { percent: Math.round(tier.refundBp / 100), hours: hours(tier.hoursBefore) });
      }
      return t("quote.cancelNoRefundWithin", { hours: hours(tier.hoursBefore) });
    });
}
