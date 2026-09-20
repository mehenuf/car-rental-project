import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate, formatNumber } from "./format";

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
