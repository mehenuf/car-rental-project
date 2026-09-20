import type {
  CancellationTier,
  ExtraConfig,
  PolicyConfig,
  PromoConfig,
  Quote,
  QuoteInput,
  RatePlanConfig,
  TaxCategory,
  TaxRuleConfig,
} from "@/lib/pricing/types";

// ---------------------------------------------------------------
// Postgres range text -> values
// ---------------------------------------------------------------

/** `[2030-07-01,2030-08-01)` (a daterange in Postgres text form). */
export function parseDateRange(text: string): { startDate: string; endDateExclusive: string } {
  const match = /^[[(](\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})[\])]$/.exec(text);
  if (!match) throw new Error(`Unrecognised daterange: ${text}`);
  return { startDate: match[1]!, endDateExclusive: match[2]! };
}

function parsePgTimestamp(text: string): Date {
  // "2030-01-01 00:00:00+00" -> "2030-01-01T00:00:00+00:00"
  const iso = text.trim().replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error(`Unrecognised timestamp: ${text}`);
  return date;
}

/** `["2030-01-01 00:00:00+00","2030-02-01 00:00:00+00")`; either end may be empty (unbounded). */
export function parseTimestampRange(text: string | null): { from: Date | null; to: Date | null } {
  if (!text) return { from: null, to: null };
  const inner = text.slice(1, -1);
  const [rawFrom = "", rawTo = ""] = inner.split(",");
  const clean = (s: string) => s.replace(/"/g, "").trim();
  const from = clean(rawFrom);
  const to = clean(rawTo);
  return { from: from ? parsePgTimestamp(from) : null, to: to ? parsePgTimestamp(to) : null };
}

// ---------------------------------------------------------------
// Row -> engine config
// ---------------------------------------------------------------

export interface RatePlanRowLike {
  base_daily_minor: number;
  weekend_uplift_bp: number;
  weekly_discount_bp: number;
  monthly_discount_bp: number;
  min_days: number;
  max_days: number | null;
}

export function mapRatePlan(
  row: RatePlanRowLike,
  seasons: { during: string; daily_minor: number }[]
): RatePlanConfig {
  return {
    baseDailyMinor: row.base_daily_minor,
    weekendUpliftBp: row.weekend_uplift_bp,
    weeklyDiscountBp: row.weekly_discount_bp,
    monthlyDiscountBp: row.monthly_discount_bp,
    minDays: row.min_days,
    maxDays: row.max_days,
    seasons: seasons.map((s) => ({ ...parseDateRange(s.during), dailyMinor: s.daily_minor })),
  };
}

export interface ExtraRowLike {
  code: string;
  name: string;
  kind: "extra" | "insurance";
  pricing: "per_day" | "per_rental";
  unit_price_minor: number;
  max_quantity: number;
  cap_minor: number | null;
  is_mandatory: boolean;
}

export function mapExtra(row: ExtraRowLike): ExtraConfig {
  return {
    code: row.code,
    name: row.name,
    kind: row.kind,
    pricing: row.pricing,
    unitPriceMinor: row.unit_price_minor,
    maxQuantity: row.max_quantity,
    capMinor: row.cap_minor,
    isMandatory: row.is_mandatory,
  };
}

export interface PolicyRowLike {
  deposit_type: "fixed" | "percent";
  deposit_value: number;
  cancellation_tiers: unknown;
  min_driver_age: number;
  young_driver_age: number | null;
  young_driver_fee_minor: number;
}

function parseTiers(value: unknown): CancellationTier[] {
  if (!Array.isArray(value)) return [];
  const tiers: CancellationTier[] = [];
  for (const item of value) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as { hours_before?: unknown }).hours_before === "number" &&
      typeof (item as { refund_bp?: unknown }).refund_bp === "number"
    ) {
      tiers.push({
        hoursBefore: (item as { hours_before: number }).hours_before,
        refundBp: (item as { refund_bp: number }).refund_bp,
      });
    }
  }
  return tiers;
}

/** A provider with no policy row gets safe defaults: no deposit, no young-driver fee. */
export function mapPolicy(row: PolicyRowLike | null): PolicyConfig {
  if (!row) {
    return {
      depositType: "fixed",
      depositValue: 0,
      cancellationTiers: [],
      minDriverAge: 21,
      youngDriverAge: null,
      youngDriverFeeMinor: 0,
    };
  }
  return {
    depositType: row.deposit_type,
    depositValue: row.deposit_value,
    cancellationTiers: parseTiers(row.cancellation_tiers),
    minDriverAge: row.min_driver_age,
    youngDriverAge: row.young_driver_age,
    youngDriverFeeMinor: row.young_driver_fee_minor,
  };
}

export function mapTaxRule(row: {
  name: string;
  rate_bp: number;
  applies_to: string[];
  inclusive: boolean;
}): TaxRuleConfig {
  return {
    name: row.name,
    rateBp: row.rate_bp,
    appliesTo: row.applies_to as TaxCategory[],
    inclusive: row.inclusive,
  };
}

export function mapPromo(row: {
  code: string;
  discount_type: "percent" | "fixed";
  value: number;
  currency: string | null;
  valid_during: string | null;
  min_days: number;
  vehicle_id: string | null;
}): PromoConfig {
  const { from, to } = parseTimestampRange(row.valid_during);
  return {
    code: row.code,
    discountType: row.discount_type,
    value: row.value,
    currency: row.currency,
    validFrom: from,
    validTo: to,
    minDays: row.min_days,
    vehicleId: row.vehicle_id,
  };
}

/** `providers.commission_rate_override` is a fraction (0.12 = 12%); the platform default is in basis points. */
export function commissionBpFor(overrideFraction: number | null, platformBp: number): number {
  return overrideFraction === null ? platformBp : Math.round(overrideFraction * 10000);
}

// ---------------------------------------------------------------
// Snapshot stored on the booking
// ---------------------------------------------------------------

export interface PriceSnapshot {
  version: 1;
  quotedAt: string;
  input: {
    vehicleId: string;
    pickupAt: string;
    dropoffAt: string;
    pickupBranchId: number;
    dropoffBranchId: number;
    extras: { code: string; quantity: number }[];
    promoCode: string | null;
    driverAge: number | null;
  };
  quote: Quote;
}

/** The accepted quote and the input that produced it. Refunds and payouts are computed from this, never from live prices. */
export function toSnapshot(quote: Quote, input: QuoteInput, now: Date = new Date()): PriceSnapshot {
  return {
    version: 1,
    quotedAt: now.toISOString(),
    input: {
      vehicleId: input.vehicleId,
      pickupAt: input.pickupAt.toISOString(),
      dropoffAt: input.dropoffAt.toISOString(),
      pickupBranchId: input.pickupBranchId,
      dropoffBranchId: input.dropoffBranchId,
      extras: input.extras.map((e) => ({ code: e.code, quantity: e.quantity })),
      promoCode: input.promoCode,
      driverAge: input.driverAge,
    },
    quote,
  };
}
