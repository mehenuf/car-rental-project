import { describe, expect, it } from "vitest";
import { methodsFor } from "@/lib/payments/methods";
import { computeRefund } from "@/lib/payments/refunds";
import { simulateConfirm, simulateOutcome } from "@/lib/payments/simulate";

describe("methodsFor", () => {
  it("offers only the global methods where no local method exists", () => {
    expect(methodsFor("US", "USD").map((m) => m.code)).toEqual(["card", "paypal", "apple_pay", "google_pay"]);
  });

  it("adds local methods for their country and currency, after the global ones", () => {
    expect(methodsFor("NL", "EUR").map((m) => m.code)).toEqual(["card", "paypal", "apple_pay", "google_pay", "ideal"]);
    expect(methodsFor("KE", "KES").map((m) => m.code)).toContain("mpesa");
    expect(methodsFor("IN", "INR").map((m) => m.code)).toContain("upi");
    expect(methodsFor("BD", "BDT").map((m) => m.code)).toContain("bkash");
  });

  it("does not offer a local method in the wrong country or currency", () => {
    expect(methodsFor("US", "USD").map((m) => m.code)).not.toContain("ideal");
    expect(methodsFor("NL", "USD").map((m) => m.code)).not.toContain("ideal");
    expect(methodsFor("KE", "USD").map((m) => m.code)).not.toContain("mpesa");
  });
});

describe("computeRefund", () => {
  const snapshot = {
    quote: {
      totalMinor: 20000,
      pickupAt: "2030-03-10T10:00:00.000Z",
      cancellationTiers: [
        { hoursBefore: 48, refundBp: 10000 },
        { hoursBefore: 24, refundBp: 5000 },
        { hoursBefore: 0, refundBp: 0 },
      ],
    },
  };
  const at = (iso: string) => new Date(iso);

  it("refunds in full when cancelling early enough", () => {
    const r = computeRefund(snapshot, at("2030-03-07T10:00:00Z"));
    expect(r).toMatchObject({ refundMinor: 20000, refundBp: 10000, hoursUntilPickup: 72 });
  });

  it("applies the middle tier", () => {
    const r = computeRefund(snapshot, at("2030-03-09T00:00:00Z")); // 34h before
    expect(r.refundBp).toBe(5000);
    expect(r.refundMinor).toBe(10000);
  });

  it("refunds nothing inside the last window, after pick-up, or with no tiers", () => {
    expect(computeRefund(snapshot, at("2030-03-10T02:00:00Z")).refundMinor).toBe(0);
    expect(computeRefund(snapshot, at("2030-03-11T00:00:00Z")).refundMinor).toBe(0);
    expect(computeRefund({ quote: { ...snapshot.quote, cancellationTiers: [] } }, at("2030-03-01T00:00:00Z")).refundMinor).toBe(0);
  });

  it("never refunds more than what is left, and supports a full refund override", () => {
    expect(computeRefund(snapshot, at("2030-03-07T10:00:00Z"), 15000).refundMinor).toBe(5000);
    expect(computeRefund(snapshot, at("2030-03-10T02:00:00Z"), 0, { full: true }).refundMinor).toBe(20000);
    expect(computeRefund(snapshot, at("2030-03-10T02:00:00Z"), 5000, { full: true }).refundMinor).toBe(15000);
    expect(computeRefund(snapshot, at("2030-03-07T10:00:00Z"), 25000).refundMinor).toBe(0);
  });
});

describe("simulated outcomes", () => {
  it("decides card outcomes from the last four digits", () => {
    expect(simulateOutcome("card", "4000 0000 0000 0002")).toEqual({ status: "failed", failureCode: "card_declined" });
    expect(simulateOutcome("card", "4000000000009995")).toEqual({ status: "failed", failureCode: "insufficient_funds" });
    expect(simulateOutcome("card", "4000000000000069")).toEqual({ status: "failed", failureCode: "expired_card" });
    expect(simulateOutcome("card", "4000000000003220")).toEqual({ status: "requires_action" });
    expect(simulateOutcome("card", "4242 4242 4242 4242")).toEqual({ status: "succeeded" });
    expect(simulateOutcome("card", null)).toEqual({ status: "succeeded" });
  });

  it("uses decline and pending keywords for non-card methods", () => {
    expect(simulateOutcome("mpesa", "decline")).toEqual({ status: "failed", failureCode: "declined_by_provider" });
    expect(simulateOutcome("upi", "pending")).toEqual({ status: "requires_action" });
    expect(simulateOutcome("ideal", "anything else")).toEqual({ status: "succeeded" });
  });

  it("confirms an action-required payment only with the right code", () => {
    expect(simulateConfirm("000000")).toEqual({ status: "succeeded" });
    expect(simulateConfirm("123456")).toEqual({ status: "failed", failureCode: "authentication_failed" });
    expect(simulateConfirm(null)).toEqual({ status: "failed", failureCode: "authentication_failed" });
  });
});
