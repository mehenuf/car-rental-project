import { describe, expect, it } from "vitest";
import {
  bpToPct,
  dateRangeInclusive,
  parseSeasonRange,
  pctToBp,
  policyFormToRow,
  policyRowToForm,
} from "@/lib/provider/pricing-forms";

describe("percent and basis point conversion", () => {
  it("converts both ways without floating point drift", () => {
    expect(pctToBp(10)).toBe(1000);
    expect(pctToBp(12.5)).toBe(1250);
    expect(pctToBp(0.07)).toBe(7);
    expect(pctToBp(33.33)).toBe(3333);
    expect(bpToPct(1250)).toBe(12.5);
    expect(bpToPct(7)).toBe(0.07);
  });
});

describe("policy form <-> row", () => {
  it("stores a fixed deposit in minor units and refund tiers in basis points, earliest first", () => {
    const row = policyFormToRow(
      {
        deposit_type: "fixed",
        deposit_value: 200,
        cancellation_tiers: [
          { hours_before: 0, refund_pct: 0 },
          { hours_before: 48, refund_pct: 100 },
          { hours_before: 24, refund_pct: 50 },
        ],
        min_driver_age: 21,
        young_driver_age: 25,
        young_driver_fee: 15,
      },
      "USD"
    );
    expect(row.deposit_value).toBe(20000);
    expect(row.cancellation_tiers).toEqual([
      { hours_before: 48, refund_bp: 10000 },
      { hours_before: 24, refund_bp: 5000 },
      { hours_before: 0, refund_bp: 0 },
    ]);
    expect(row.young_driver_fee_minor).toBe(1500);
  });

  it("stores a percentage deposit in basis points", () => {
    const row = policyFormToRow(
      { deposit_type: "percent", deposit_value: 25, cancellation_tiers: [], min_driver_age: 21, young_driver_age: null, young_driver_fee: 0 },
      "USD"
    );
    expect(row.deposit_value).toBe(2500);
  });

  it("round-trips through the row and back to what the person typed", () => {
    const form = {
      deposit_type: "fixed" as const,
      deposit_value: 150.5,
      cancellation_tiers: [
        { hours_before: 72, refund_pct: 100 },
        { hours_before: 0, refund_pct: 0 },
      ],
      min_driver_age: 23,
      young_driver_age: 25,
      young_driver_fee: 12.25,
    };
    expect(policyRowToForm(policyFormToRow(form, "USD"), "USD")).toEqual(form);
  });

  it("handles zero-decimal currencies", () => {
    const row = policyFormToRow(
      { deposit_type: "fixed", deposit_value: 30000, cancellation_tiers: [], min_driver_age: 21, young_driver_age: null, young_driver_fee: 0 },
      "JPY"
    );
    expect(row.deposit_value).toBe(30000);
  });
});

describe("season ranges", () => {
  it("turns inclusive dates into a Postgres daterange and back", () => {
    expect(dateRangeInclusive("2030-07-01", "2030-07-31")).toBe("[2030-07-01,2030-08-01)");
    expect(dateRangeInclusive("2030-12-31", "2030-12-31")).toBe("[2030-12-31,2031-01-01)");
    expect(parseSeasonRange("[2030-07-01,2030-08-01)")).toEqual({ start_date: "2030-07-01", end_date: "2030-07-31" });
  });
});
