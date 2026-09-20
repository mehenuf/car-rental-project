import { describe, expect, it } from "vitest";
import { buildAuditRow, clientIp } from "./audit";

describe("clientIp", () => {
  it("takes the first address of x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
  });
  it("falls back to x-real-ip or null", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe("buildAuditRow", () => {
  const actor = { userId: "u1", role: "finance" as const };
  const headers = new Headers({ "x-forwarded-for": "203.0.113.5", "user-agent": "Mozilla/5.0", "x-vercel-id": "iad1::abc" });

  it("records who, what, where and why", () => {
    const row = buildAuditRow({ actor, action: "refund.issue", entityType: "booking", entityId: "b1", before: { status: "paid" }, after: { status: "refunded" }, reason: "goodwill", headers });
    expect(row).toMatchObject({
      actor_user_id: "u1", actor_role: "finance", action: "refund.issue", entity_type: "booking", entity_id: "b1",
      reason: "goodwill", ip: "203.0.113.5", user_agent: "Mozilla/5.0", request_id: "iad1::abc",
    });
  });
  it("redacts secrets in before and after", () => {
    const row = buildAuditRow({ actor, action: "x", entityType: "y", before: { api_key: "k" }, after: { nested: { password: "p", ok: 1 } }, headers });
    expect(row.before).toEqual({ api_key: "[redacted]" });
    expect(row.after).toEqual({ nested: { password: "[redacted]", ok: 1 } });
  });
  it("truncates a very long user agent and reason", () => {
    const row = buildAuditRow({ actor, action: "x", entityType: "y", reason: "r".repeat(2000), headers: new Headers({ "user-agent": "u".repeat(1000) }) });
    expect(row.reason!.length).toBe(500);
    expect(row.user_agent!.length).toBe(300);
  });
});
