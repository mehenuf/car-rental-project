import { describe, expect, it } from "vitest";
import { formatMoney, formatDateLocale, formatList, formatNumberLocale, formatRelative } from "./format";

describe("i18n format", () => {
  it("formats currency by locale and currency code", () => {
    expect(formatMoney(1234.5, "USD", "en")).toBe("$1,234.50");
    expect(formatMoney(1234.5, "EUR", "de")).toBe("1.234,50 €");
    expect(formatMoney(5000, "JPY", "ja")).toMatch(/5,000/);
  });
  it("uses Western digits for Arabic", () => {
    expect(formatNumberLocale(1234, "ar")).toBe("1,234");
  });
  it("formats dates", () => {
    const d = new Date("2026-03-05T12:00:00Z");
    expect(formatDateLocale(d, "en", "UTC")).toBe("Mar 5, 2026");
    expect(formatDateLocale(d, "de", "UTC")).toBe("05.03.2026");
  });
  it("joins lists", () => {
    expect(formatList(["a", "b", "c"], "en")).toBe("a, b, and c");
    expect(formatList(["a", "b"], "es")).toBe("a y b");
  });
  it("formats relative time", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    expect(formatRelative(new Date("2026-01-09T00:00:00Z"), "en", now)).toBe("yesterday");
    expect(formatRelative(new Date("2026-01-07T00:00:00Z"), "en", now)).toBe("3 days ago");
    expect(formatRelative(new Date("2026-01-10T02:00:00Z"), "en", now)).toBe("in 2 hours");
  });
});
