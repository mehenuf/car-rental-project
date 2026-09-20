/** All money in these types is integer minor units (cents) of the quote currency. */

export type TaxCategory = "rental" | "extras" | "fees";

export interface SeasonConfig {
  /** First day of the season, `YYYY-MM-DD` in the branch time zone (inclusive). */
  startDate: string;
  /** Day after the last day of the season (exclusive). */
  endDateExclusive: string;
  dailyMinor: number;
}

export interface RatePlanConfig {
  baseDailyMinor: number;
  weekendUpliftBp: number;
  /** Applies from 7 days. */
  weeklyDiscountBp: number;
  /** Applies from 28 days, when greater than zero. */
  monthlyDiscountBp: number;
  minDays: number;
  maxDays: number | null;
  seasons: SeasonConfig[];
}

export interface ExtraConfig {
  code: string;
  name: string;
  kind: "extra" | "insurance";
  pricing: "per_day" | "per_rental";
  unitPriceMinor: number;
  maxQuantity: number;
  /** Cap on the per-unit total of an extra (for example a maximum charge for a per-day extra). */
  capMinor: number | null;
  isMandatory: boolean;
}

export interface CancellationTier {
  hoursBefore: number;
  refundBp: number;
}

export interface PolicyConfig {
  depositType: "fixed" | "percent";
  /** Minor units when fixed, basis points of the subtotal when percent. */
  depositValue: number;
  cancellationTiers: CancellationTier[];
  minDriverAge: number;
  youngDriverAge: number | null;
  youngDriverFeeMinor: number;
}

export interface TaxRuleConfig {
  name: string;
  rateBp: number;
  appliesTo: TaxCategory[];
  inclusive: boolean;
}

export interface PromoConfig {
  code: string;
  discountType: "percent" | "fixed";
  /** Basis points when percent, minor units when fixed. */
  value: number;
  /** Required for fixed promos; must equal the quote currency. */
  currency: string | null;
  validFrom: Date | null;
  validTo: Date | null;
  minDays: number;
  vehicleId: string | null;
}

export interface QuoteConfig {
  currency: string;
  /** IANA time zone of the pickup branch; decides weekend and season days. */
  timezone: string;
  ratePlan: RatePlanConfig;
  extras: ExtraConfig[];
  policy: PolicyConfig;
  oneWayFeeMinor: number;
  pickupSurchargeMinor: number;
  taxRules: TaxRuleConfig[];
  /** The promo the caller's code resolved to (or null). */
  promo: PromoConfig | null;
  commissionBp: number;
  serviceFeeBp: number;
}

export interface QuoteInput {
  vehicleId: string;
  pickupAt: Date;
  dropoffAt: Date;
  pickupBranchId: number;
  dropoffBranchId: number;
  extras: { code: string; quantity: number }[];
  promoCode: string | null;
  driverAge: number | null;
}

export type LineKind =
  | "base"
  | "season"
  | "weekend"
  | "duration_discount"
  | "promo"
  | "extra"
  | "young_driver"
  | "one_way"
  | "pickup_surcharge"
  | "tax"
  | "service_fee";

export interface QuoteLine {
  kind: LineKind;
  code?: string;
  label: string;
  quantity?: number;
  amountMinor: number;
  /** Informational only: already inside other lines, not added to the total. */
  included?: boolean;
  category?: TaxCategory;
}

export interface Quote {
  currency: string;
  days: number;
  pickupAt: string;
  dropoffAt: string;
  lines: QuoteLine[];
  /** Rental + extras + fees, before added taxes and the service fee. */
  subtotalMinor: number;
  /** Taxes added on top (excludes inclusive taxes). */
  taxMinor: number;
  serviceFeeMinor: number;
  totalMinor: number;
  /** A refundable hold, never part of the total. */
  depositMinor: number;
  commissionMinor: number;
  providerPayoutMinor: number;
  platformRevenueMinor: number;
  cancellationTiers: CancellationTier[];
}
