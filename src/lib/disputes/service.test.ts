import { describe, expect, it } from "vitest";
import { executeResolution, settleAgreed, type DisputePorts } from "./service";

function ports(over: Partial<DisputePorts> = {}) {
  const calls: string[] = [];
  const p: DisputePorts = {
    getDispute: async () => ({ id: "d1", booking_id: "b1", type: "damage", status: "agreed", agreed_amount_minor: 3000, offer_minor: 3000 }),
    capture: async (b, amount) => void calls.push(`capture:${b}:${amount}`),
    refund: async (b, amount, key) => (calls.push(`refund:${b}:${amount}:${key}`), { paymentId: "pay1" }),
    resolve: async (a) => void calls.push(`resolve:${a.resolution}:${a.amountMinor ?? "-"}:${a.refundPaymentId ?? "-"}`),
    ...over,
  };
  return { p, calls };
}

const actor = { actorUserId: "u1", actorSide: "platform" as const, note: "ok" };

describe("executeResolution", () => {
  it("captures from the deposit first, then records the outcome", async () => {
    const { p, calls } = ports();
    await executeResolution(p, { disputeId: "d1", resolution: "capture", amountMinor: 3000, ...actor });
    expect(calls).toEqual(["capture:b1:3000", "resolve:capture:3000:-"]);
  });
  it("refunds through the payment provider, then records the refund payment", async () => {
    const { p, calls } = ports();
    await executeResolution(p, { disputeId: "d1", resolution: "refund", amountMinor: 4000, ...actor });
    expect(calls).toEqual(["refund:b1:4000:dispute-refund:d1", "resolve:refund:4000:pay1"]);
  });
  it("dismissal moves no money", async () => {
    const { p, calls } = ports();
    await executeResolution(p, { disputeId: "d1", resolution: "dismiss", ...actor });
    expect(calls).toEqual(["resolve:dismiss:-:-"]);
  });
  it("does not record the outcome when the provider refund fails", async () => {
    const { p, calls } = ports({ refund: async () => null });
    await expect(executeResolution(p, { disputeId: "d1", resolution: "refund", amountMinor: 4000, ...actor })).rejects.toThrow(/refund/i);
    expect(calls).toEqual([]);
  });
  it("needs an amount to capture or refund", async () => {
    const { p } = ports();
    await expect(executeResolution(p, { disputeId: "d1", resolution: "capture", ...actor })).rejects.toThrow(/amount/i);
  });
  it("refuses a dispute that is already closed", async () => {
    const { p } = ports({ getDispute: async () => ({ id: "d1", booking_id: "b1", type: "damage", status: "resolved", agreed_amount_minor: 1, offer_minor: 1 }) });
    await expect(executeResolution(p, { disputeId: "d1", resolution: "dismiss", ...actor })).rejects.toThrow(/closed/i);
  });
});

describe("settleAgreed", () => {
  it("captures the agreed amount for a provider claim", async () => {
    const { p, calls } = ports();
    await settleAgreed(p, "d1", actor);
    expect(calls).toEqual(["capture:b1:3000", "resolve:capture:3000:-"]);
  });
  it("refunds the agreed amount for a renter complaint", async () => {
    const { p, calls } = ports({ getDispute: async () => ({ id: "d1", booking_id: "b1", type: "overcharge", status: "agreed", agreed_amount_minor: 2500, offer_minor: 2500 }) });
    await settleAgreed(p, "d1", actor);
    expect(calls[0]).toBe("refund:b1:2500:dispute-refund:d1");
  });
  it("an agreed amount of zero simply closes the dispute", async () => {
    const { p, calls } = ports({ getDispute: async () => ({ id: "d1", booking_id: "b1", type: "damage", status: "agreed", agreed_amount_minor: 0, offer_minor: 0 }) });
    await settleAgreed(p, "d1", actor);
    expect(calls).toEqual(["resolve:dismiss:-:-"]);
  });
  it("only settles a dispute that has been agreed", async () => {
    const { p } = ports({ getDispute: async () => ({ id: "d1", booking_id: "b1", type: "damage", status: "negotiating", agreed_amount_minor: null, offer_minor: 100 }) });
    await expect(settleAgreed(p, "d1", actor)).rejects.toThrow(/agreed/i);
  });
});
