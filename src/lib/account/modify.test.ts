import { describe, expect, it } from "vitest";
import { canModify, modificationDeadline, settleDelta } from "./modify";

const pickup = new Date("2026-10-10T10:00:00Z");
const tiers = [
  { hoursBefore: 48, refundBp: 10000 },
  { hoursBefore: 24, refundBp: 5000 },
  { hoursBefore: 0, refundBp: 0 },
];

describe("modificationDeadline", () => {
  it("is the free-cancellation deadline", () => {
    expect(modificationDeadline(pickup, tiers)?.toISOString()).toBe("2026-10-08T10:00:00.000Z");
  });
  it("picks the tightest full-refund tier when several exist", () => {
    const t = [
      { hoursBefore: 72, refundBp: 10000 },
      { hoursBefore: 24, refundBp: 10000 },
    ];
    expect(modificationDeadline(pickup, t)?.toISOString()).toBe("2026-10-09T10:00:00.000Z");
  });
  it("is null with no free-cancellation window", () => {
    expect(modificationDeadline(pickup, [{ hoursBefore: 24, refundBp: 5000 }])).toBeNull();
    expect(modificationDeadline(pickup, [])).toBeNull();
  });
});

describe("canModify", () => {
  const early = new Date("2026-10-01T00:00:00Z");
  it("allows a confirmed booking before the deadline", () => {
    expect(canModify(early, pickup, tiers, "confirmed")).toEqual({ ok: true });
  });
  it("rejects after the deadline", () => {
    expect(canModify(new Date("2026-10-08T10:00:01Z"), pickup, tiers, "confirmed")).toEqual({
      ok: false,
      reason: "deadline_passed",
    });
  });
  it("rejects when the provider offers no free window", () => {
    expect(canModify(early, pickup, [], "confirmed")).toEqual({ ok: false, reason: "no_free_window" });
  });
  it("rejects bookings that are not confirmed", () => {
    for (const status of ["pending", "active", "completed", "cancelled", "no_show"]) {
      expect(canModify(early, pickup, tiers, status)).toEqual({ ok: false, reason: "not_modifiable" });
    }
  });
});

describe("settleDelta", () => {
  it("charges a supplement when the total rises", () => {
    expect(settleDelta(10000, 12500)).toEqual({ kind: "supplement", amountMinor: 2500 });
  });
  it("refunds when it falls", () => {
    expect(settleDelta(10000, 7000)).toEqual({ kind: "refund", amountMinor: 3000 });
  });
  it("does nothing when equal", () => {
    expect(settleDelta(10000, 10000)).toEqual({ kind: "none", amountMinor: 0 });
  });
});
