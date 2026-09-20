import { describe, expect, it } from "vitest";
import { QuoteError } from "@/lib/pricing/errors";
import { quote } from "@/lib/pricing/engine";
import type { PromoConfig, Quote, QuoteConfig, QuoteInput } from "@/lib/pricing/types";

const NOW = new Date("2030-01-01T00:00:00Z");

function config(overrides: Partial<QuoteConfig> = {}): QuoteConfig {
  return {
    currency: "USD",
    timezone: "UTC",
    ratePlan: {
      baseDailyMinor: 5000,
      weekendUpliftBp: 0,
      weeklyDiscountBp: 0,
      monthlyDiscountBp: 0,
      minDays: 1,
      maxDays: null,
      seasons: [],
    },
    extras: [],
    policy: {
      depositType: "fixed",
      depositValue: 0,
      cancellationTiers: [],
      minDriverAge: 21,
      youngDriverAge: null,
      youngDriverFeeMinor: 0,
    },
    oneWayFeeMinor: 0,
    pickupSurchargeMinor: 0,
    taxRules: [],
    promo: null,
    commissionBp: 0,
    serviceFeeBp: 0,
    ...overrides,
  };
}

function input(overrides: Partial<QuoteInput> = {}): QuoteInput {
  return {
    vehicleId: "v1",
    pickupAt: new Date("2030-03-01T10:00:00Z"), // a Friday
    dropoffAt: new Date("2030-03-04T10:00:00Z"), // Monday: 3 days
    pickupBranchId: 1,
    dropoffBranchId: 1,
    extras: [],
    promoCode: null,
    driverAge: null,
    ...overrides,
  };
}

const run = (i: QuoteInput, c: QuoteConfig) => quote(i, c, { now: NOW });
const amountOf = (q: Quote, kind: string) => q.lines.find((l) => l.kind === kind)?.amountMinor;

function promo(overrides: Partial<PromoConfig> = {}): PromoConfig {
  return {
    code: "SAVE10",
    discountType: "percent",
    value: 1000,
    currency: null,
    validFrom: null,
    validTo: null,
    minDays: 1,
    vehicleId: null,
    ...overrides,
  };
}

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (err) {
    return err instanceof QuoteError ? err.code : `other:${String(err)}`;
  }
  return undefined;
}

describe("rental pricing", () => {
  it("prices whole days at the base rate", () => {
    const q = run(input(), config());
    expect(q.days).toBe(3);
    expect(q.totalMinor).toBe(15000);
    expect(q.lines.map((l) => l.kind)).toEqual(["base"]);
  });

  it("adds a weekend uplift per weekend day", () => {
    // Fri, Sat, Sun: two weekend days at 20% of 5000
    const q = run(input(), config({ ratePlan: { ...config().ratePlan, weekendUpliftBp: 2000 } }));
    expect(amountOf(q, "weekend")).toBe(2000);
    expect(q.totalMinor).toBe(17000);
  });

  it("applies season rates, and weekend uplift on the season rate", () => {
    const q = run(
      input(),
      config({
        ratePlan: {
          ...config().ratePlan,
          weekendUpliftBp: 2000,
          seasons: [{ startDate: "2030-03-02", endDateExclusive: "2030-03-03", dailyMinor: 8000 }],
        },
      })
    );
    expect(amountOf(q, "season")).toBe(3000);
    expect(amountOf(q, "weekend")).toBe(1600 + 1000);
    expect(q.totalMinor).toBe(20600);
  });

  it("decides weekend days in the branch time zone", () => {
    const one = input({
      pickupAt: new Date("2030-03-01T20:00:00Z"),
      dropoffAt: new Date("2030-03-02T20:00:00Z"),
    });
    const plan = { ...config().ratePlan, weekendUpliftBp: 2000 };
    // UTC: Friday. Auckland (UTC+13 in March): Saturday 09:00.
    expect(run(one, config({ ratePlan: plan })).totalMinor).toBe(5000);
    expect(run(one, config({ ratePlan: plan, timezone: "Pacific/Auckland" })).totalMinor).toBe(6000);
  });

  it("applies weekly and monthly duration discounts", () => {
    const seven = input({ dropoffAt: new Date("2030-03-08T10:00:00Z") });
    const plan = { ...config().ratePlan, weeklyDiscountBp: 1000, monthlyDiscountBp: 2000 };
    const w = run(seven, config({ ratePlan: plan }));
    expect(w.days).toBe(7);
    expect(amountOf(w, "duration_discount")).toBe(-3500);
    expect(w.totalMinor).toBe(31500);

    const month = input({ dropoffAt: new Date("2030-03-29T10:00:00Z") });
    const m = run(month, config({ ratePlan: plan }));
    expect(m.days).toBe(28);
    expect(m.totalMinor).toBe(112000);
  });

  it("enforces minimum and maximum days", () => {
    const short = input({ dropoffAt: new Date("2030-03-02T10:00:00Z") });
    expect(code(() => run(short, config({ ratePlan: { ...config().ratePlan, minDays: 3 } })))).toBe("MIN_DAYS");
    expect(code(() => run(input(), config({ ratePlan: { ...config().ratePlan, maxDays: 2 } })))).toBe("MAX_DAYS");
  });

  it("rejects a drop-off that is not after pick-up", () => {
    const bad = input({ dropoffAt: new Date("2030-03-01T09:00:00Z") });
    expect(code(() => run(bad, config()))).toBe("BAD_INPUT");
  });

  it("rejects unsupported currencies", () => {
    expect(code(() => run(input(), config({ currency: "KWD" })))).toBe("UNSUPPORTED_CURRENCY");
  });
});

describe("promo codes", () => {
  it("applies a percentage promo (case-insensitive code)", () => {
    const q = run(input({ promoCode: "save10" }), config({ promo: promo() }));
    expect(amountOf(q, "promo")).toBe(-1500);
    expect(q.totalMinor).toBe(13500);
  });

  it("applies a fixed promo and never goes below zero", () => {
    const fixed = run(input({ promoCode: "SAVE10" }), config({ promo: promo({ discountType: "fixed", value: 2000, currency: "USD" }) }));
    expect(amountOf(fixed, "promo")).toBe(-2000);
    const huge = run(input({ promoCode: "SAVE10" }), config({ promo: promo({ discountType: "fixed", value: 99999, currency: "USD" }) }));
    expect(amountOf(huge, "promo")).toBe(-15000);
    expect(huge.totalMinor).toBe(0);
  });

  it("applies after the duration discount", () => {
    const seven = input({ dropoffAt: new Date("2030-03-08T10:00:00Z"), promoCode: "SAVE10" });
    const q = run(seven, config({ promo: promo(), ratePlan: { ...config().ratePlan, weeklyDiscountBp: 1000 } }));
    expect(q.lines.map((l) => l.kind)).toEqual(["base", "duration_discount", "promo"]);
    expect(amountOf(q, "promo")).toBe(-3150);
    expect(q.totalMinor).toBe(28350);
  });

  it("rejects codes that are unknown, expired, too early, wrong vehicle or wrong currency", () => {
    const withCode = input({ promoCode: "SAVE10" });
    expect(code(() => run(withCode, config({ promo: null })))).toBe("PROMO_INVALID");
    expect(code(() => run(withCode, config({ promo: promo({ code: "OTHER" }) })))).toBe("PROMO_INVALID");
    expect(code(() => run(withCode, config({ promo: promo({ validTo: new Date("2029-12-31T00:00:00Z") }) })))).toBe("PROMO_INVALID");
    expect(code(() => run(withCode, config({ promo: promo({ validFrom: new Date("2030-02-01T00:00:00Z") }) })))).toBe("PROMO_INVALID");
    expect(code(() => run(withCode, config({ promo: promo({ minDays: 5 }) })))).toBe("PROMO_INVALID");
    expect(code(() => run(withCode, config({ promo: promo({ vehicleId: "other" }) })))).toBe("PROMO_INVALID");
    expect(code(() => run(withCode, config({ promo: promo({ discountType: "fixed", value: 500, currency: "EUR" }) })))).toBe("PROMO_INVALID");
  });
});

describe("extras", () => {
  const extras = [
    { code: "seat", name: "Child seat", kind: "extra" as const, pricing: "per_day" as const, unitPriceMinor: 1000, maxQuantity: 2, capMinor: 2500, isMandatory: false },
    { code: "gps", name: "GPS", kind: "extra" as const, pricing: "per_rental" as const, unitPriceMinor: 1500, maxQuantity: 1, capMinor: null, isMandatory: false },
    { code: "cdw", name: "Damage waiver", kind: "insurance" as const, pricing: "per_day" as const, unitPriceMinor: 700, maxQuantity: 1, capMinor: null, isMandatory: true },
  ];

  it("adds mandatory extras automatically", () => {
    const q = run(input(), config({ extras }));
    expect(q.lines.find((l) => l.code === "cdw")?.amountMinor).toBe(2100);
    expect(q.totalMinor).toBe(15000 + 2100);
  });

  it("prices per-day extras with a per-unit cap, and per-rental extras once", () => {
    const q = run(input({ extras: [{ code: "seat", quantity: 2 }, { code: "gps", quantity: 1 }] }), config({ extras }));
    expect(q.lines.find((l) => l.code === "seat")?.amountMinor).toBe(2 * 2500);
    expect(q.lines.find((l) => l.code === "gps")?.amountMinor).toBe(1500);
    expect(q.totalMinor).toBe(15000 + 2100 + 5000 + 1500);
  });

  it("rejects unknown extras and bad quantities", () => {
    expect(code(() => run(input({ extras: [{ code: "jetpack", quantity: 1 }] }), config({ extras })))).toBe("UNKNOWN_EXTRA");
    expect(code(() => run(input({ extras: [{ code: "seat", quantity: 3 }] }), config({ extras })))).toBe("EXTRA_QUANTITY");
    expect(code(() => run(input({ extras: [{ code: "seat", quantity: 0 }] }), config({ extras })))).toBe("EXTRA_QUANTITY");
  });
});

describe("fees and driver age", () => {
  it("adds one-way and pickup surcharge fees", () => {
    const c = config({ oneWayFeeMinor: 3000, pickupSurchargeMinor: 1000 });
    const roundTrip = run(input(), c);
    expect(amountOf(roundTrip, "one_way")).toBeUndefined();
    expect(roundTrip.totalMinor).toBe(16000);
    const oneWay = run(input({ dropoffBranchId: 2 }), c);
    expect(amountOf(oneWay, "one_way")).toBe(3000);
    expect(oneWay.totalMinor).toBe(19000);
  });

  it("charges a young-driver fee per day and rejects drivers under the minimum age", () => {
    const policy = { ...config().policy, youngDriverAge: 25, youngDriverFeeMinor: 500 };
    expect(amountOf(run(input({ driverAge: 23 }), config({ policy })), "young_driver")).toBe(1500);
    expect(amountOf(run(input({ driverAge: 30 }), config({ policy })), "young_driver")).toBeUndefined();
    expect(amountOf(run(input({ driverAge: null }), config({ policy })), "young_driver")).toBeUndefined();
    expect(code(() => run(input({ driverAge: 19 }), config({ policy })))).toBe("DRIVER_TOO_YOUNG");
  });
});

describe("taxes", () => {
  it("adds exclusive tax on top of the taxed categories", () => {
    const q = run(input(), config({ taxRules: [{ name: "VAT", rateBp: 2000, appliesTo: ["rental"], inclusive: false }] }));
    expect(amountOf(q, "tax")).toBe(3000);
    expect(q.taxMinor).toBe(3000);
    expect(q.totalMinor).toBe(18000);
  });

  it("shows inclusive tax as an included line without changing the total", () => {
    const c = config({
      ratePlan: { ...config().ratePlan, baseDailyMinor: 4000 },
      taxRules: [{ name: "VAT", rateBp: 2000, appliesTo: ["rental"], inclusive: true }],
    });
    const q = run(input(), c);
    const taxLine = q.lines.find((l) => l.kind === "tax");
    expect(taxLine?.amountMinor).toBe(2000);
    expect(taxLine?.included).toBe(true);
    expect(q.taxMinor).toBe(0);
    expect(q.totalMinor).toBe(12000);
  });

  it("only taxes the categories a rule applies to", () => {
    const extras = [{ code: "gps", name: "GPS", kind: "extra" as const, pricing: "per_rental" as const, unitPriceMinor: 5000, maxQuantity: 1, capMinor: null, isMandatory: false }];
    const q = run(
      input({ extras: [{ code: "gps", quantity: 1 }] }),
      config({ extras, taxRules: [{ name: "Tourism", rateBp: 1000, appliesTo: ["extras"], inclusive: false }] })
    );
    expect(amountOf(q, "tax")).toBe(500);
  });
});

describe("totals, deposit and payout split", () => {
  it("adds a visible service fee and splits payout and platform revenue", () => {
    const q = run(input(), config({ commissionBp: 1500, serviceFeeBp: 500 }));
    expect(amountOf(q, "service_fee")).toBe(750);
    expect(q.totalMinor).toBe(15750);
    expect(q.commissionMinor).toBe(2250);
    expect(q.providerPayoutMinor).toBe(12750);
    expect(q.platformRevenueMinor).toBe(3000);
    expect(q.providerPayoutMinor + q.platformRevenueMinor).toBe(q.totalMinor);
  });

  it("leaves tax with the provider when splitting", () => {
    const q = run(
      input(),
      config({ commissionBp: 1500, serviceFeeBp: 500, taxRules: [{ name: "VAT", rateBp: 2000, appliesTo: ["rental"], inclusive: false }] })
    );
    expect(q.totalMinor).toBe(18750);
    expect(q.providerPayoutMinor).toBe(15750);
    expect(q.platformRevenueMinor).toBe(3000);
  });

  it("computes the deposit separately from the total", () => {
    const fixed = run(input(), config({ policy: { ...config().policy, depositType: "fixed", depositValue: 20000 } }));
    expect(fixed.depositMinor).toBe(20000);
    expect(fixed.totalMinor).toBe(15000);
    const pct = run(input(), config({ policy: { ...config().policy, depositType: "percent", depositValue: 5000 } }));
    expect(pct.depositMinor).toBe(7500);
  });

  it("carries the cancellation policy, currency and dates", () => {
    const tiers = [{ hoursBefore: 48, refundBp: 10000 }, { hoursBefore: 0, refundBp: 0 }];
    const q = run(input(), config({ policy: { ...config().policy, cancellationTiers: tiers } }));
    expect(q.cancellationTiers).toEqual(tiers);
    expect(q.currency).toBe("USD");
    expect(q.pickupAt).toBe("2030-03-01T10:00:00.000Z");
  });
});

describe("invariants over many random configurations", () => {
  // Small deterministic LCG so failures are reproducible.
  let seed = 42;
  const rand = (n: number) => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed % n;
  };

  it("keeps totals equal to the sum of lines and payout + platform equal to the total", () => {
    for (let i = 0; i < 300; i++) {
      const days = 1 + rand(40);
      const c = config({
        currency: rand(4) === 0 ? "JPY" : "USD",
        timezone: ["UTC", "Pacific/Auckland", "America/New_York"][rand(3)]!,
        ratePlan: {
          baseDailyMinor: 1000 + rand(20000),
          weekendUpliftBp: rand(3000),
          weeklyDiscountBp: rand(2000),
          monthlyDiscountBp: rand(3000),
          minDays: 1,
          maxDays: null,
          seasons: rand(2) ? [{ startDate: "2030-03-03", endDateExclusive: "2030-03-10", dailyMinor: 500 + rand(30000) }] : [],
        },
        oneWayFeeMinor: rand(5000),
        pickupSurchargeMinor: rand(2000),
        taxRules: rand(2)
          ? [
              { name: "VAT", rateBp: rand(2500), appliesTo: ["rental", "extras", "fees"], inclusive: rand(2) === 0 },
              { name: "Local", rateBp: rand(500), appliesTo: ["rental"], inclusive: false },
            ]
          : [],
        commissionBp: rand(3000),
        serviceFeeBp: rand(800),
        promo: rand(2) ? promo({ value: 1 + rand(3000) }) : null,
        policy: { ...config().policy, depositType: "percent", depositValue: rand(10000) },
      });
      const start = new Date("2030-03-01T10:00:00Z");
      const q = quote(
        input({
          pickupAt: start,
          dropoffAt: new Date(start.getTime() + days * 86400_000),
          dropoffBranchId: rand(2) + 1,
          promoCode: c.promo ? "SAVE10" : null,
        }),
        c,
        { now: NOW }
      );
      const sum = q.lines.filter((l) => !l.included).reduce((s, l) => s + l.amountMinor, 0);
      expect(q.totalMinor, `total #${i}`).toBe(sum);
      expect(q.providerPayoutMinor + q.platformRevenueMinor, `split #${i}`).toBe(q.totalMinor);
      expect(q.totalMinor).toBeGreaterThanOrEqual(0);
      for (const line of q.lines) expect(Number.isInteger(line.amountMinor), `${line.kind} integer`).toBe(true);
      expect(Number.isInteger(q.depositMinor)).toBe(true);
    }
  });
});
