import { describe, expect, it } from "vitest";
import { describeCancellation } from "@/lib/pricing/format";

describe("describeCancellation", () => {
  it("describes free cancellation followed by no refund", () => {
    expect(
      describeCancellation([
        { hoursBefore: 48, refundBp: 10000 },
        { hoursBefore: 0, refundBp: 0 },
      ])
    ).toEqual(["Free cancellation up to 48 hours before pick-up", "No refund after that"]);
  });

  it("orders tiers from the earliest and describes partial refunds", () => {
    expect(
      describeCancellation([
        { hoursBefore: 0, refundBp: 0 },
        { hoursBefore: 24, refundBp: 5000 },
        { hoursBefore: 72, refundBp: 10000 },
      ])
    ).toEqual([
      "Free cancellation up to 72 hours before pick-up",
      "50% refund up to 24 hours before pick-up",
      "No refund after that",
    ]);
  });

  it("uses singular hour", () => {
    expect(describeCancellation([{ hoursBefore: 1, refundBp: 10000 }, { hoursBefore: 0, refundBp: 0 }])[0]).toBe(
      "Free cancellation up to 1 hour before pick-up"
    );
  });

  it("falls back when the provider set no tiers", () => {
    expect(describeCancellation([])).toEqual(["Cancellation terms are set by the rental company."]);
  });
});
