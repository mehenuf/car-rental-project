import { describe, expect, it } from "vitest";
import { billableDays } from "@/lib/pricing/days";
import { QuoteError } from "@/lib/pricing/errors";
import {
  currencyExponent,
  formatMinor,
  majorToMinor,
  minorToMajor,
  mulBp,
} from "@/lib/pricing/money";

describe("mulBp (half-up integer basis-point multiply)", () => {
  it("rounds half up", () => {
    expect(mulBp(5, 1000)).toBe(1); // 0.5 -> 1
    expect(mulBp(101, 1500)).toBe(15); // 15.15
    expect(mulBp(103, 1500)).toBe(15); // 15.45
    expect(mulBp(105, 1500)).toBe(16); // 15.75
  });

  it("is symmetric for negatives", () => {
    expect(mulBp(-5, 1000)).toBe(-1);
    expect(mulBp(-105, 1500)).toBe(-16);
  });

  it("handles zero and full amounts", () => {
    expect(mulBp(0, 1500)).toBe(0);
    expect(mulBp(12345, 10000)).toBe(12345);
    expect(mulBp(12345, 0)).toBe(0);
  });
});

describe("currency handling", () => {
  it("knows 0 and 2 decimal currencies", () => {
    expect(currencyExponent("USD")).toBe(2);
    expect(currencyExponent("JPY")).toBe(0);
  });

  it("rejects unsupported currencies such as 3-decimal KWD", () => {
    expect(() => currencyExponent("KWD")).toThrow(QuoteError);
    try {
      currencyExponent("KWD");
    } catch (err) {
      expect((err as QuoteError).code).toBe("UNSUPPORTED_CURRENCY");
    }
  });

  it("converts between minor and major units", () => {
    expect(minorToMajor(12345, "USD")).toBe(123.45);
    expect(minorToMajor(500, "JPY")).toBe(500);
    expect(majorToMinor(48, "USD")).toBe(4800);
    expect(majorToMinor(19.99, "USD")).toBe(1999);
    expect(majorToMinor(500, "JPY")).toBe(500);
  });

  it("formats minor units for display", () => {
    expect(formatMinor(12345, "USD")).toBe("$123.45");
    expect(formatMinor(500, "JPY")).toMatch(/500/);
  });
});

describe("billableDays (24h periods, 59 minute grace, minimum 1)", () => {
  const start = new Date("2030-03-01T10:00:00Z");
  const plus = (ms: number) => new Date(start.getTime() + ms);
  const H = 3600_000;
  const M = 60_000;

  it("charges a minimum of one day", () => {
    expect(billableDays(start, plus(1 * H))).toBe(1);
    expect(billableDays(start, plus(24 * H))).toBe(1);
  });

  it("gives a 59 minute grace after each 24h period", () => {
    expect(billableDays(start, plus(24 * H + 59 * M))).toBe(1);
    expect(billableDays(start, plus(24 * H + 60 * M))).toBe(2);
    expect(billableDays(start, plus(25 * H + 5 * M))).toBe(2);
    expect(billableDays(start, plus(72 * H))).toBe(3);
    expect(billableDays(start, plus(72 * H + 30 * M))).toBe(3);
  });

  it("accepts ISO strings", () => {
    expect(billableDays("2030-03-01T10:00:00Z", "2030-03-04T10:00:00Z")).toBe(3);
  });
});
