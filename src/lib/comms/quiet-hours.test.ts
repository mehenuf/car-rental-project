import { describe, expect, it } from "vitest";
import { isQuietHour, nextAllowedTime } from "./quiet-hours";

describe("isQuietHour", () => {
  it("is quiet from 21:00 to 08:00 local time", () => {
    expect(isQuietHour(new Date("2026-06-10T20:59:00Z"), "UTC")).toBe(false);
    expect(isQuietHour(new Date("2026-06-10T21:00:00Z"), "UTC")).toBe(true);
    expect(isQuietHour(new Date("2026-06-11T07:59:00Z"), "UTC")).toBe(true);
    expect(isQuietHour(new Date("2026-06-11T08:00:00Z"), "UTC")).toBe(false);
  });
  it("uses the recipient's time zone", () => {
    // 12:00 UTC is 21:00 in Tokyo, 08:00 in New York (EDT).
    const noon = new Date("2026-06-10T12:00:00Z");
    expect(isQuietHour(noon, "Asia/Tokyo")).toBe(true);
    expect(isQuietHour(noon, "America/New_York")).toBe(false);
  });
});

describe("nextAllowedTime", () => {
  it("returns the same instant when not quiet", () => {
    const at = new Date("2026-06-10T10:00:00Z");
    expect(nextAllowedTime(at, "UTC").toISOString()).toBe(at.toISOString());
  });
  it("holds an evening message until 08:00 the next morning", () => {
    expect(nextAllowedTime(new Date("2026-06-10T22:30:00Z"), "UTC").toISOString()).toBe("2026-06-11T08:00:00.000Z");
  });
  it("holds an early-morning message until 08:00 the same day", () => {
    expect(nextAllowedTime(new Date("2026-06-11T03:00:00Z"), "UTC").toISOString()).toBe("2026-06-11T08:00:00.000Z");
  });
  it("converts 08:00 local back to UTC across zones", () => {
    // 13:00 UTC on 10 June is 22:00 in Tokyo, so the next 08:00 Tokyo is 23:00 UTC on 10 June.
    expect(nextAllowedTime(new Date("2026-06-10T13:00:00Z"), "Asia/Tokyo").toISOString()).toBe("2026-06-10T23:00:00.000Z");
  });
  it("handles daylight saving changes", () => {
    // New York, night of 2026-03-07 (EST, UTC-5) to 08 March (clocks go forward at 02:00, EDT UTC-4).
    // 23:00 EST on 7 March is 04:00 UTC on 8 March; 08:00 local next morning is EDT, 12:00 UTC.
    expect(nextAllowedTime(new Date("2026-03-08T04:00:00Z"), "America/New_York").toISOString()).toBe("2026-03-08T12:00:00.000Z");
  });
});
