import { describe, expect, it } from "vitest";
import { postMessage, type MessagingDeps } from "./messaging";

const booking = { id: "b1", user_id: "cust", provider_id: "prov", payment_status: "paid", status: "confirmed" };

function deps(over: Partial<MessagingDeps> = {}) {
  const inserted: { thread_id: string; sender_side: string; body: string; flagged: boolean }[] = [];
  const d: MessagingDeps = {
    getBooking: async () => booking,
    isProviderMember: async (_p, u) => u === "agent",
    ensureThread: async () => "t1",
    insertMessage: async (m) => void inserted.push(m),
    ...over,
  };
  return { d, inserted };
}

describe("postMessage", () => {
  it("lets the customer message the provider on their own booking", async () => {
    const { d, inserted } = deps();
    expect(await postMessage(d, { bookingId: "b1", userId: "cust", side: "customer", body: "Hello" })).toEqual({ ok: true });
    expect(inserted).toEqual([{ thread_id: "t1", sender_side: "customer", body: "Hello", flagged: false, sender_user_id: "cust" }]);
  });
  it("lets a provider team member reply", async () => {
    const { d, inserted } = deps();
    expect(await postMessage(d, { bookingId: "b1", userId: "agent", side: "provider", body: "See you then" })).toEqual({ ok: true });
    expect(inserted[0]!.sender_side).toBe("provider");
  });
  it("refuses someone who is not a party to the booking", async () => {
    const { d, inserted } = deps();
    expect(await postMessage(d, { bookingId: "b1", userId: "stranger", side: "customer", body: "Hi" })).toEqual({ ok: false, reason: "forbidden" });
    expect(await postMessage(d, { bookingId: "b1", userId: "stranger", side: "provider", body: "Hi" })).toEqual({ ok: false, reason: "forbidden" });
    expect(inserted).toHaveLength(0);
  });
  it("refuses a missing booking", async () => {
    const { d } = deps({ getBooking: async () => null });
    expect(await postMessage(d, { bookingId: "x", userId: "cust", side: "customer", body: "Hi" })).toEqual({ ok: false, reason: "not_found" });
  });
  it("blocks contact details before payment and off-platform payment always", async () => {
    const unpaid = deps({ getBooking: async () => ({ ...booking, payment_status: "unpaid", status: "pending" }) });
    expect(await postMessage(unpaid.d, { bookingId: "b1", userId: "cust", side: "customer", body: "Call me +44 7700 900123" })).toEqual({ ok: false, reason: "contact_details" });
    const paid = deps();
    expect(await postMessage(paid.d, { bookingId: "b1", userId: "cust", side: "customer", body: "Pay me by Western Union" })).toEqual({ ok: false, reason: "off_platform_payment" });
  });
  it("stores a flag on messages with links after payment", async () => {
    const { d, inserted } = deps();
    await postMessage(d, { bookingId: "b1", userId: "cust", side: "customer", body: "Map: https://example.com/x" });
    expect(inserted[0]!.flagged).toBe(true);
  });
  it("does not allow messages on a cancelled booking", async () => {
    const { d } = deps({ getBooking: async () => ({ ...booking, status: "cancelled" }) });
    expect(await postMessage(d, { bookingId: "b1", userId: "cust", side: "customer", body: "Hi" })).toEqual({ ok: false, reason: "closed" });
  });
});
