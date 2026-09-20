import { describe, expect, it } from "vitest";
import { formatReceiptNumber, parseReceiptNumber } from "./receipt";

describe("receipt numbers", () => {
  it("formats with the year and a six-digit sequence", () => {
    expect(formatReceiptNumber(2026, 1)).toBe("R-2026-000001");
    expect(formatReceiptNumber(2026, 123456)).toBe("R-2026-123456");
  });
  it("keeps growing past six digits rather than truncating", () => {
    expect(formatReceiptNumber(2026, 1234567)).toBe("R-2026-1234567");
  });
  it("round-trips", () => {
    expect(parseReceiptNumber("R-2026-000042")).toEqual({ year: 2026, sequence: 42 });
  });
  it("rejects malformed numbers", () => {
    expect(parseReceiptNumber("2026-42")).toBeNull();
    expect(parseReceiptNumber("R-26-000001")).toBeNull();
    expect(() => formatReceiptNumber(2026, 0)).toThrow();
  });
});
