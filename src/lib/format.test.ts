import { describe, expect, it } from "vitest";
import { formatBookingTotal, formatCurrency, formatDate, formatNumber } from "./format";

describe("format helpers keep English defaults and accept a locale", () => {
  it("defaults to the existing English output", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
    expect(formatNumber(1234567)).toBe("1,234,567");
    expect(formatDate("2026-03-05T12:00:00Z")).toBe("Mar 05, 2026");
  });
  it("formats for another locale", () => {
    expect(formatCurrency(1234.5, "de")).toBe("1.234,50 $");
    expect(formatNumber(1234567, "de")).toBe("1.234.567");
    expect(formatNumber(1234, "ar")).toBe("1,234");
    expect(formatDate("2026-03-05T12:00:00Z", "de")).toBe("05.03.2026");
  });
});

describe("formatBookingTotal", () => {
  it("shows a booking in the currency it was made in", () => {
    expect(formatBookingTotal({ total_amount: 3300, currency: "BDT" }, "en")).toContain("3,300.00");
    expect(formatBookingTotal({ total_amount: 3300, currency: "BDT" }, "en")).not.toContain("$");
    expect(formatBookingTotal({ total_amount: 12000, currency: "JPY" }, "en")).toContain("12,000");
  });

  it("falls back to dollars when the currency is missing or unknown", () => {
    expect(formatBookingTotal({ total_amount: 48, currency: null }, "en")).toBe("$48.00");
    expect(formatBookingTotal({ total_amount: 48, currency: "??" }, "en")).toBe("$48.00");
  });
});
