import { describe, expect, it } from "vitest";
import { ageOn, checkDriverAge } from "./age";

describe("ageOn", () => {
  it("counts whole years and handles the birthday itself", () => {
    expect(ageOn("1990-06-15", new Date("2026-06-14T12:00:00Z"), "UTC")).toBe(35);
    expect(ageOn("1990-06-15", new Date("2026-06-15T12:00:00Z"), "UTC")).toBe(36);
  });
  it("uses the calendar date in the given time zone", () => {
    // 2026-06-14 20:00 UTC is already 15 June in Tokyo.
    const on = new Date("2026-06-14T20:00:00Z");
    expect(ageOn("1990-06-15", on, "UTC")).toBe(35);
    expect(ageOn("1990-06-15", on, "Asia/Tokyo")).toBe(36);
  });
  it("handles a 29 February birthday in a common year", () => {
    expect(ageOn("2000-02-29", new Date("2026-02-28T12:00:00Z"), "UTC")).toBe(25);
    expect(ageOn("2000-02-29", new Date("2026-03-01T12:00:00Z"), "UTC")).toBe(26);
  });
  it("rejects a malformed date", () => {
    expect(() => ageOn("15/06/1990", new Date(), "UTC")).toThrow();
  });
});

describe("checkDriverAge", () => {
  const policy = { minAge: 21, youngDriverAge: 25 };
  it("blocks drivers under the minimum age", () => {
    expect(checkDriverAge(20, policy)).toBe("too_young");
  });
  it("flags the young-driver band, exclusive of the upper age", () => {
    expect(checkDriverAge(21, policy)).toBe("young_driver_band");
    expect(checkDriverAge(24, policy)).toBe("young_driver_band");
    expect(checkDriverAge(25, policy)).toBe("ok");
  });
  it("has no band when the provider sets none", () => {
    expect(checkDriverAge(22, { minAge: 21, youngDriverAge: null })).toBe("ok");
  });
});
