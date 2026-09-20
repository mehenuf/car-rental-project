import { billableDays } from "@/lib/pricing/days";
import { QuoteError } from "@/lib/pricing/errors";
import { currencyExponent, mulBp } from "@/lib/pricing/money";
import type { Quote, QuoteConfig, QuoteInput, QuoteLine } from "@/lib/pricing/types";

const DAY_MS = 86_400_000;

/** The local date (`YYYY-MM-DD`) and weekend flag of the start of each billable day, in the branch time zone. */
function localDays(pickupAt: Date, days: number, timeZone: string): { date: string; weekend: boolean }[] {
  const dateFormat = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const weekdayFormat = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" });
  return Array.from({ length: days }, (_, i) => {
    const start = new Date(pickupAt.getTime() + i * DAY_MS);
    const weekday = weekdayFormat.format(start);
    return { date: dateFormat.format(start), weekend: weekday === "Sat" || weekday === "Sun" };
  });
}

/**
 * Prices a rental. Pure: no I/O, no clock unless `opts.now` is omitted (used
 * only for promo validity). All amounts are integer minor units.
 *
 * Invariants (tested): the total equals the sum of the non-included lines,
 * and providerPayout + platformRevenue equals the total.
 */
export function quote(input: QuoteInput, config: QuoteConfig, opts: { now?: Date } = {}): Quote {
  const now = opts.now ?? new Date();
  currencyExponent(config.currency); // rejects unsupported currencies

  if (!(input.dropoffAt.getTime() > input.pickupAt.getTime())) {
    throw new QuoteError("BAD_INPUT", "Drop-off must be after pick-up.");
  }

  const plan = config.ratePlan;
  const policy = config.policy;
  const days = billableDays(input.pickupAt, input.dropoffAt);
  if (days < plan.minDays) {
    throw new QuoteError("MIN_DAYS", `The minimum rental is ${plan.minDays} day${plan.minDays === 1 ? "" : "s"}.`);
  }
  if (plan.maxDays !== null && days > plan.maxDays) {
    throw new QuoteError("MAX_DAYS", `The maximum rental is ${plan.maxDays} days.`);
  }

  const lines: QuoteLine[] = [];
  const push = (line: QuoteLine): number => {
    lines.push(line);
    return line.amountMinor;
  };

  // ---- Rental: base, season, weekend, duration discount, promo ----
  let seasonAdjustment = 0;
  let weekendUplift = 0;
  for (const day of localDays(input.pickupAt, days, config.timezone)) {
    const season = plan.seasons.find((s) => day.date >= s.startDate && day.date < s.endDateExclusive);
    const daily = season ? season.dailyMinor : plan.baseDailyMinor;
    seasonAdjustment += daily - plan.baseDailyMinor;
    if (day.weekend) weekendUplift += mulBp(daily, plan.weekendUpliftBp);
  }

  let rental = 0;
  rental += push({
    kind: "base",
    label: `Base rate (${days} day${days === 1 ? "" : "s"})`,
    quantity: days,
    amountMinor: days * plan.baseDailyMinor,
    category: "rental",
  });
  if (seasonAdjustment !== 0) {
    rental += push({ kind: "season", label: "Seasonal rate adjustment", amountMinor: seasonAdjustment, category: "rental" });
  }
  if (weekendUplift > 0) {
    rental += push({ kind: "weekend", label: "Weekend rate", amountMinor: weekendUplift, category: "rental" });
  }

  const durationBp = days >= 28 && plan.monthlyDiscountBp > 0 ? plan.monthlyDiscountBp : days >= 7 ? plan.weeklyDiscountBp : 0;
  if (durationBp > 0) {
    const amount = -mulBp(rental, durationBp);
    if (amount !== 0) {
      rental += push({ kind: "duration_discount", label: days >= 28 ? "Monthly discount" : "Weekly discount", amountMinor: amount, category: "rental" });
    }
  }

  if (input.promoCode) {
    const promo = config.promo;
    const invalid = (why: string) => new QuoteError("PROMO_INVALID", why);
    if (!promo || promo.code.toLowerCase() !== input.promoCode.trim().toLowerCase()) throw invalid("This promo code is not valid.");
    if ((promo.validFrom && now < promo.validFrom) || (promo.validTo && now > promo.validTo)) throw invalid("This promo code is not valid at this time.");
    if (days < promo.minDays) throw invalid(`This promo code needs a rental of at least ${promo.minDays} days.`);
    if (promo.vehicleId && promo.vehicleId !== input.vehicleId) throw invalid("This promo code does not apply to this vehicle.");
    if (promo.discountType === "fixed" && promo.currency !== config.currency) throw invalid("This promo code is not valid in this currency.");

    const raw = promo.discountType === "percent" ? mulBp(rental, promo.value) : promo.value;
    const amount = -Math.min(raw, rental);
    if (amount !== 0) {
      rental += push({ kind: "promo", code: promo.code, label: `Promo ${promo.code}`, amountMinor: amount, category: "rental" });
    }
  }

  // ---- Extras ----
  for (const request of input.extras) {
    const def = config.extras.find((e) => e.code === request.code);
    if (!def) throw new QuoteError("UNKNOWN_EXTRA", `Unknown extra "${request.code}".`);
    if (!Number.isInteger(request.quantity) || request.quantity < 1 || request.quantity > def.maxQuantity) {
      throw new QuoteError("EXTRA_QUANTITY", `Choose between 1 and ${def.maxQuantity} of "${def.name}".`);
    }
  }
  const requested = new Map(input.extras.map((r) => [r.code, r.quantity]));

  let extras = 0;
  for (const def of config.extras) {
    const quantity = requested.get(def.code) ?? (def.isMandatory ? 1 : 0);
    if (quantity === 0) continue;
    let unitTotal = def.pricing === "per_day" ? def.unitPriceMinor * days : def.unitPriceMinor;
    if (def.capMinor !== null) unitTotal = Math.min(unitTotal, def.capMinor);
    extras += push({
      kind: "extra",
      code: def.code,
      label: quantity > 1 ? `${def.name} x ${quantity}` : def.name,
      quantity,
      amountMinor: unitTotal * quantity,
      category: "extras",
    });
  }

  // ---- Fees ----
  let fees = 0;
  if (input.driverAge !== null) {
    if (input.driverAge < policy.minDriverAge) {
      throw new QuoteError("DRIVER_TOO_YOUNG", `Drivers must be at least ${policy.minDriverAge} years old.`);
    }
    if (policy.youngDriverAge !== null && input.driverAge < policy.youngDriverAge && policy.youngDriverFeeMinor > 0) {
      fees += push({
        kind: "young_driver",
        label: `Young driver fee (${days} day${days === 1 ? "" : "s"})`,
        quantity: days,
        amountMinor: policy.youngDriverFeeMinor * days,
        category: "fees",
      });
    }
  }
  if (input.pickupBranchId !== input.dropoffBranchId && config.oneWayFeeMinor > 0) {
    fees += push({ kind: "one_way", label: "One-way fee", amountMinor: config.oneWayFeeMinor, category: "fees" });
  }
  if (config.pickupSurchargeMinor > 0) {
    fees += push({ kind: "pickup_surcharge", label: "Pick-up location surcharge", amountMinor: config.pickupSurchargeMinor, category: "fees" });
  }

  // ---- Taxes ----
  const bases = { rental, extras, fees };
  let addedTax = 0;
  let includedTax = 0;
  for (const rule of config.taxRules) {
    const taxable = rule.appliesTo.reduce((sum, category) => sum + bases[category], 0);
    if (taxable <= 0) continue;
    if (rule.inclusive) {
      const denominator = 10000 + rule.rateBp;
      const net = Math.floor((taxable * 10000 + Math.floor(denominator / 2)) / denominator);
      const tax = taxable - net;
      if (tax === 0) continue;
      includedTax += push({ kind: "tax", label: `${rule.name} (included)`, amountMinor: tax, included: true });
    } else {
      const tax = mulBp(taxable, rule.rateBp);
      if (tax === 0) continue;
      addedTax += push({ kind: "tax", label: rule.name, amountMinor: tax });
    }
  }

  // ---- Totals, deposit, split ----
  const subtotal = rental + extras + fees;
  const serviceFee = mulBp(subtotal, config.serviceFeeBp);
  if (serviceFee > 0) push({ kind: "service_fee", label: "Service fee", amountMinor: serviceFee });
  const total = subtotal + addedTax + serviceFee;

  const deposit = policy.depositType === "fixed" ? policy.depositValue : mulBp(subtotal, policy.depositValue);

  const commission = mulBp(subtotal - includedTax, config.commissionBp);
  const providerPayout = total - serviceFee - commission;
  const platformRevenue = commission + serviceFee;

  return {
    currency: config.currency,
    days,
    pickupAt: input.pickupAt.toISOString(),
    dropoffAt: input.dropoffAt.toISOString(),
    lines,
    subtotalMinor: subtotal,
    taxMinor: addedTax,
    serviceFeeMinor: serviceFee,
    totalMinor: total,
    depositMinor: deposit,
    commissionMinor: commission,
    providerPayoutMinor: providerPayout,
    platformRevenueMinor: platformRevenue,
    cancellationTiers: policy.cancellationTiers,
  };
}
