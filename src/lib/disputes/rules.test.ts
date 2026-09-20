import { describe, expect, it } from "vitest";
import {
  DISPUTE_TYPES,
  OpenDisputeSchema,
  RespondDisputeSchema,
  canOpenDispute,
  canRespond,
  disputeDeadline,
  disputeWindowEnds,
  nextResolution,
  typesFor,
} from "./rules";

describe("dispute types by side", () => {
  it("providers claim damage or cleanliness and fees; renters complain about listing, price or service", () => {
    expect(typesFor("provider")).toEqual(["damage", "cleanliness_or_fees"]);
    expect(typesFor("customer")).toEqual(["listing_mismatch", "overcharge", "service_problem"]);
    expect(DISPUTE_TYPES).toHaveLength(5);
  });
});

describe("opening window", () => {
  const completed = new Date("2026-06-01T12:00:00Z");
  it("is 48 hours after the return", () => {
    expect(disputeWindowEnds(completed).toISOString()).toBe("2026-06-03T12:00:00.000Z");
    expect(canOpenDispute({ status: "completed", completedAt: completed, now: new Date("2026-06-03T11:59:00Z"), hasOpenDispute: false })).toEqual({ ok: true });
    expect(canOpenDispute({ status: "completed", completedAt: completed, now: new Date("2026-06-03T12:01:00Z"), hasOpenDispute: false })).toEqual({ ok: false, reason: "window_closed" });
  });
  it("needs a completed rental and no dispute already open", () => {
    expect(canOpenDispute({ status: "active", completedAt: null, now: completed, hasOpenDispute: false })).toEqual({ ok: false, reason: "not_completed" });
    expect(canOpenDispute({ status: "completed", completedAt: completed, now: completed, hasOpenDispute: true })).toEqual({ ok: false, reason: "already_open" });
  });
});

describe("deadline", () => {
  it("is 72 hours from the last step", () => {
    expect(disputeDeadline(new Date("2026-06-01T00:00:00Z")).toISOString()).toBe("2026-06-04T00:00:00.000Z");
  });
});

describe("canRespond", () => {
  const base = { status: "awaiting_response" as const, offerBySide: "provider" as const, offerCount: 0 };
  it("only the other side can accept, counter or contest the current offer", () => {
    expect(canRespond({ ...base, side: "customer", action: "accept" })).toBe(true);
    expect(canRespond({ ...base, side: "provider", action: "accept" })).toBe(false);
    expect(canRespond({ ...base, side: "provider", action: "counter" })).toBe(false);
    expect(canRespond({ ...base, side: "customer", action: "contest" })).toBe(true);
  });
  it("either side can always add a message or evidence while the dispute is open", () => {
    expect(canRespond({ ...base, side: "provider", action: "message" })).toBe(true);
    expect(canRespond({ ...base, side: "provider", action: "evidence" })).toBe(true);
  });
  it("counters stop after five offers", () => {
    expect(canRespond({ ...base, side: "customer", action: "counter", offerCount: 5 })).toBe(false);
    expect(canRespond({ ...base, side: "customer", action: "counter", offerCount: 4 })).toBe(true);
  });
  it("nothing is possible once agreed, escalated to a reviewer or closed", () => {
    for (const status of ["agreed", "resolved", "dismissed"] as const) {
      expect(canRespond({ ...base, status, side: "customer", action: "message" })).toBe(false);
    }
  });
});

describe("nextResolution", () => {
  it("captures the deposit for provider claims and refunds the renter for renter complaints", () => {
    expect(nextResolution("damage")).toBe("capture");
    expect(nextResolution("cleanliness_or_fees")).toBe("capture");
    expect(nextResolution("overcharge")).toBe("refund");
    expect(nextResolution("listing_mismatch")).toBe("refund");
    expect(nextResolution("service_problem")).toBe("refund");
  });
});

describe("schemas", () => {
  it("a provider claim needs an amount, a renter complaint may omit it", () => {
    expect(OpenDisputeSchema.safeParse({ booking_id: "8d2f1b1e-8c46-4a5e-9d5c-1f2a3b4c5d6e", type: "damage", body: "Dent" }).success).toBe(false);
    expect(OpenDisputeSchema.safeParse({ booking_id: "8d2f1b1e-8c46-4a5e-9d5c-1f2a3b4c5d6e", type: "damage", body: "Dent", claimed_amount_minor: 5000 }).success).toBe(true);
    expect(OpenDisputeSchema.safeParse({ booking_id: "8d2f1b1e-8c46-4a5e-9d5c-1f2a3b4c5d6e", type: "service_problem", body: "Rude" }).success).toBe(true);
  });
  it("a counter offer needs an amount; other actions do not", () => {
    expect(RespondDisputeSchema.safeParse({ action: "counter" }).success).toBe(false);
    expect(RespondDisputeSchema.safeParse({ action: "counter", amount_minor: 2000 }).success).toBe(true);
    expect(RespondDisputeSchema.safeParse({ action: "accept" }).success).toBe(true);
    expect(RespondDisputeSchema.safeParse({ action: "message" }).success).toBe(false);
    expect(RespondDisputeSchema.safeParse({ action: "message", body: "Hello" }).success).toBe(true);
  });
});
