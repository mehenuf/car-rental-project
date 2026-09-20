import { describe, expect, it } from "vitest";
import {
  commissionBpFor,
  mapExtra,
  mapPolicy,
  mapPromo,
  mapRatePlan,
  mapTaxRule,
  parseDateRange,
  parseTimestampRange,
  toSnapshot,
} from "@/lib/pricing/mappers";
import { quote } from "@/lib/pricing/engine";
import type { QuoteConfig, QuoteInput } from "@/lib/pricing/types";

describe("range parsing", () => {
  it("parses a daterange", () => {
    expect(parseDateRange("[2030-07-01,2030-08-01)")).toEqual({
      startDate: "2030-07-01",
      endDateExclusive: "2030-08-01",
    });
  });

  it("parses a tstzrange with quoted bounds", () => {
    const r = parseTimestampRange('["2030-01-01 00:00:00+00","2030-02-01 00:00:00+00")');
    expect(r.from?.toISOString()).toBe("2030-01-01T00:00:00.000Z");
    expect(r.to?.toISOString()).toBe("2030-02-01T00:00:00.000Z");
  });

  it("handles open ends and null", () => {
    const open = parseTimestampRange('["2030-01-01 00:00:00+00",)');
    expect(open.from).not.toBeNull();
    expect(open.to).toBeNull();
    expect(parseTimestampRange(null)).toEqual({ from: null, to: null });
  });

  it("rejects a malformed daterange", () => {
    expect(() => parseDateRange("nonsense")).toThrow();
  });
});

describe("row mappers", () => {
  it("maps a rate plan with its seasons", () => {
    const plan = mapRatePlan(
      {
        base_daily_minor: 4800,
        weekend_uplift_bp: 1000,
        weekly_discount_bp: 500,
        monthly_discount_bp: 1500,
        min_days: 2,
        max_days: 30,
      },
      [{ during: "[2030-07-01,2030-08-01)", daily_minor: 6000 }]
    );
    expect(plan).toEqual({
      baseDailyMinor: 4800,
      weekendUpliftBp: 1000,
      weeklyDiscountBp: 500,
      monthlyDiscountBp: 1500,
      minDays: 2,
      maxDays: 30,
      seasons: [{ startDate: "2030-07-01", endDateExclusive: "2030-08-01", dailyMinor: 6000 }],
    });
  });

  it("maps an extra", () => {
    expect(
      mapExtra({
        code: "seat",
        name: "Child seat",
        kind: "extra",
        pricing: "per_day",
        unit_price_minor: 1000,
        max_quantity: 2,
        cap_minor: 2500,
        is_mandatory: false,
      })
    ).toEqual({
      code: "seat",
      name: "Child seat",
      kind: "extra",
      pricing: "per_day",
      unitPriceMinor: 1000,
      maxQuantity: 2,
      capMinor: 2500,
      isMandatory: false,
    });
  });

  it("maps a policy, with safe defaults when the provider has none", () => {
    expect(mapPolicy(null)).toEqual({
      depositType: "fixed",
      depositValue: 0,
      cancellationTiers: [],
      minDriverAge: 21,
      youngDriverAge: null,
      youngDriverFeeMinor: 0,
    });
    const p = mapPolicy({
      deposit_type: "percent",
      deposit_value: 2500,
      cancellation_tiers: [{ hours_before: 48, refund_bp: 10000 }, { hours_before: 0, refund_bp: 0 }],
      min_driver_age: 23,
      young_driver_age: 25,
      young_driver_fee_minor: 1500,
    });
    expect(p.cancellationTiers).toEqual([
      { hoursBefore: 48, refundBp: 10000 },
      { hoursBefore: 0, refundBp: 0 },
    ]);
    expect(p.depositType).toBe("percent");
    expect(p.youngDriverAge).toBe(25);
  });

  it("drops malformed cancellation tiers instead of failing the quote", () => {
    const p = mapPolicy({
      deposit_type: "fixed",
      deposit_value: 0,
      cancellation_tiers: "garbage" as never,
      min_driver_age: 21,
      young_driver_age: null,
      young_driver_fee_minor: 0,
    });
    expect(p.cancellationTiers).toEqual([]);
  });

  it("maps a tax rule and a promo", () => {
    expect(mapTaxRule({ name: "VAT", rate_bp: 2000, applies_to: ["rental", "extras"], inclusive: true })).toEqual({
      name: "VAT",
      rateBp: 2000,
      appliesTo: ["rental", "extras"],
      inclusive: true,
    });
    const promo = mapPromo({
      code: "SAVE10",
      discount_type: "percent",
      value: 1000,
      currency: null,
      valid_during: '["2030-01-01 00:00:00+00","2030-02-01 00:00:00+00")',
      min_days: 3,
      vehicle_id: null,
    });
    expect(promo.validFrom?.toISOString()).toBe("2030-01-01T00:00:00.000Z");
    expect(promo.validTo?.toISOString()).toBe("2030-02-01T00:00:00.000Z");
    expect(promo).toMatchObject({ code: "SAVE10", discountType: "percent", value: 1000, minDays: 3, vehicleId: null });
  });
});

describe("commissionBpFor", () => {
  it("uses the provider override when set, else the platform default", () => {
    expect(commissionBpFor(0.12, 1500)).toBe(1200);
    expect(commissionBpFor(0, 1500)).toBe(0);
    expect(commissionBpFor(null, 1500)).toBe(1500);
  });
});

describe("toSnapshot", () => {
  it("stores the quote and its input for later refunds and payouts", () => {
    const input: QuoteInput = {
      vehicleId: "v1",
      pickupAt: new Date("2030-03-05T10:00:00Z"),
      dropoffAt: new Date("2030-03-08T10:00:00Z"),
      pickupBranchId: 1,
      dropoffBranchId: 1,
      extras: [],
      promoCode: null,
      driverAge: null,
    };
    const config = { currency: "USD" } as QuoteConfig;
    void config;
    const q = quote(input, {
      currency: "USD",
      timezone: "UTC",
      ratePlan: { baseDailyMinor: 5000, weekendUpliftBp: 0, weeklyDiscountBp: 0, monthlyDiscountBp: 0, minDays: 1, maxDays: null, seasons: [] },
      extras: [],
      policy: mapPolicy(null),
      oneWayFeeMinor: 0,
      pickupSurchargeMinor: 0,
      taxRules: [],
      promo: null,
      commissionBp: 1500,
      serviceFeeBp: 0,
    });
    const snapshot = toSnapshot(q, input, new Date("2030-03-01T00:00:00Z"));
    expect(snapshot.version).toBe(1);
    expect(snapshot.quote.totalMinor).toBe(15000);
    expect(snapshot.input.vehicleId).toBe("v1");
    expect(snapshot.quotedAt).toBe("2030-03-01T00:00:00.000Z");
    // It must survive a JSON round trip (it is stored as jsonb).
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});
