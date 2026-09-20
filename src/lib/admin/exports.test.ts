import { describe, expect, it } from "vitest";
import { EXPORTS, MAX_EXPORT_DAYS, parseRange } from "./exports";
import { PERMISSIONS } from "./permissions";

describe("export catalogue", () => {
  it("every export needs a real permission and lists columns", () => {
    for (const [name, spec] of Object.entries(EXPORTS)) {
      expect(PERMISSIONS, name).toContain(spec.permission);
      expect(spec.columns.length, name).toBeGreaterThan(0);
    }
  });
  it("never exports provider references or secrets", () => {
    for (const spec of Object.values(EXPORTS)) {
      for (const c of spec.columns) expect(c).not.toMatch(/provider_ref|secret|token|password|idempotency/);
    }
  });
});

describe("parseRange", () => {
  it("accepts a normal range and widens it to whole days", () => {
    expect(parseRange("2026-01-01", "2026-01-31", true)).toEqual({ from: "2026-01-01T00:00:00Z", to: "2026-01-31T23:59:59.999Z" });
  });
  it("requires both dates, in order, and at most a year", () => {
    expect(parseRange(null, "2026-01-31", true)).toHaveProperty("error");
    expect(parseRange("2026-02-01", "2026-01-01", true)).toHaveProperty("error");
    expect(parseRange("2026-01-01", "2027-06-01", true)).toHaveProperty("error");
    expect(MAX_EXPORT_DAYS).toBe(366);
    expect(parseRange("nope", "2026-01-01", true)).toHaveProperty("error");
  });
  it("ignores the range for exports that have none", () => {
    expect(parseRange(null, null, false)).toEqual({ from: null, to: null });
  });
});
