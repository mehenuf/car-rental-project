import { describe, expect, it } from "vitest";
import { canApprove, needsApproval, thresholdMinor } from "./approvals";
import { csvCell, csvRow, csvStream } from "./csv";
import { approxTotal, groupByCurrency } from "./currency";
import { PERMISSIONS, ROLES, can, permissionsFor } from "./permissions";
import { reconciliationProblems } from "./reconcile";
import { redact } from "./redact";

describe("permission matrix", () => {
  it("has the four roles", () => {
    expect([...ROLES].sort()).toEqual(["finance", "reviewer", "super_admin", "support"]);
  });
  it("super admin can do everything", () => {
    for (const p of PERMISSIONS) expect(can("super_admin", p), p).toBe(true);
  });
  it("reviewers review providers, licences, reviews, reports, risk and disputes, and nothing financial", () => {
    for (const p of ["providers.review", "licences.review", "reviews.moderate", "reports.handle", "risk.clear", "disputes.decide"] as const) {
      expect(can("reviewer", p), p).toBe(true);
    }
    for (const p of ["exports.run", "payouts.manage", "staff.manage", "settings.manage", "ledger.read"] as const) {
      expect(can("reviewer", p), p).toBe(false);
    }
  });
  it("support reads customers and bookings, cancels and refunds within a limit, but cannot export or manage money", () => {
    expect(can("support", "customers.read")).toBe(true);
    expect(can("support", "bookings.read")).toBe(true);
    expect(can("support", "refunds.issue")).toBe(true);
    expect(can("support", "exports.run")).toBe(false);
    expect(can("support", "payouts.manage")).toBe(false);
    expect(can("support", "audit.read")).toBe(false);
  });
  it("finance handles money, reports, exports and fees, but not staff or reviews", () => {
    for (const p of ["payments.read", "refunds.issue", "payouts.manage", "ledger.read", "reports.read", "exports.run", "fees.manage"] as const) {
      expect(can("finance", p), p).toBe(true);
    }
    expect(can("finance", "staff.manage")).toBe(false);
    expect(can("finance", "reviews.moderate")).toBe(false);
  });
  it("an unknown or missing role can do nothing", () => {
    expect(can(null, "reports.read")).toBe(false);
    expect(can("owner" as never, "reports.read")).toBe(false);
    expect(permissionsFor(null)).toEqual([]);
  });
});

describe("approvals", () => {
  it("converts the per-role limit to minor units by currency exponent", () => {
    expect(thresholdMinor("support", "USD")).toBe(10_000);
    expect(thresholdMinor("support", "JPY")).toBe(100);
    expect(thresholdMinor("finance", "USD")).toBe(100_000);
  });
  it("refunds and dispute decisions above the role's limit need a second person", () => {
    expect(needsApproval({ kind: "refund", role: "support", amountMinor: 10_000, currency: "USD" })).toBe(false);
    expect(needsApproval({ kind: "refund", role: "support", amountMinor: 10_001, currency: "USD" })).toBe(true);
    expect(needsApproval({ kind: "dispute_decision", role: "reviewer", amountMinor: 50_000, currency: "USD" })).toBe(true);
    expect(needsApproval({ kind: "dispute_decision", role: "finance", amountMinor: 50_000, currency: "USD" })).toBe(false);
  });
  it("payout release and fee changes always need approval, even for a super admin", () => {
    expect(needsApproval({ kind: "payout_release", role: "super_admin", amountMinor: 1, currency: "USD" })).toBe(true);
    expect(needsApproval({ kind: "fee_change", role: "super_admin", amountMinor: 0, currency: "USD" })).toBe(true);
  });
  it("only finance or a super admin can decide, and never their own request", () => {
    expect(canApprove({ deciderRole: "finance", deciderId: "b", requesterId: "a" })).toBe(true);
    expect(canApprove({ deciderRole: "super_admin", deciderId: "b", requesterId: "a" })).toBe(true);
    expect(canApprove({ deciderRole: "finance", deciderId: "a", requesterId: "a" })).toBe(false);
    expect(canApprove({ deciderRole: "support", deciderId: "b", requesterId: "a" })).toBe(false);
  });
});

describe("csv", () => {
  it("quotes cells with commas, quotes and newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(csvCell("plain")).toBe("plain");
  });
  it("renders null, numbers and dates", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(12.5)).toBe("12.5");
    expect(csvCell(new Date("2026-01-02T03:04:05Z"))).toBe("2026-01-02T03:04:05.000Z");
  });
  it("neutralises spreadsheet formulas", () => {
    for (const v of ["=1+1", "+cmd", "-2", "@SUM(A1)", "\t=x"]) expect(csvCell(v).startsWith("'") || csvCell(v).startsWith('"\'')).toBe(true);
    expect(csvCell(-5)).toBe("-5");
  });
  it("joins a row", () => {
    expect(csvRow(["a", 1, null])).toBe("a,1,");
  });
  it("streams a header and rows in chunks", async () => {
    async function* rows() {
      yield { id: 1, name: "A" };
      yield { id: 2, name: "B,C" };
    }
    const out: string[] = [];
    for await (const chunk of csvStream(rows(), ["id", "name"])) out.push(chunk);
    expect(out.join("")).toBe('id,name\r\n1,A\r\n2,"B,C"\r\n');
  });
});

describe("currency grouping", () => {
  it("groups rows by currency without adding across them", () => {
    const groups = groupByCurrency(
      [{ currency: "USD", amount: 100 }, { currency: "EUR", amount: 50 }, { currency: "USD", amount: 25 }],
      (r) => r.amount
    );
    expect(groups).toEqual([{ currency: "EUR", total: 50 }, { currency: "USD", total: 125 }]);
  });
  it("adds an indicative total in one currency using rates, or says it cannot", () => {
    const rates = [{ date: "2026-09-01", base: "EUR", quote: "USD", rate: 1.1 }];
    const groups = [{ currency: "USD", total: 10_000 }, { currency: "EUR", total: 10_000 }];
    expect(approxTotal(groups, "USD", rates)).toEqual({ ok: true, totalMinor: 21_000 });
    expect(approxTotal([{ currency: "JPY", total: 500 }], "USD", rates)).toEqual({ ok: false, missing: ["JPY"] });
  });
});

describe("reconciliation", () => {
  it("passes when every difference is zero", () => {
    expect(reconciliationProblems({ trial: [{ currency: "USD", difference_minor: 0 }], payments: [{ currency: "USD", difference_minor: 0 }], payouts: [] })).toEqual([]);
  });
  it("names each currency and check that is off", () => {
    const problems = reconciliationProblems({
      trial: [{ currency: "USD", difference_minor: 0 }],
      payments: [{ currency: "EUR", difference_minor: -700 }],
      payouts: [{ currency: "USD", difference_minor: 50 }],
    });
    expect(problems).toEqual([
      { check: "payments", currency: "EUR", differenceMinor: -700 },
      { check: "payouts", currency: "USD", differenceMinor: 50 },
    ]);
  });
});

describe("redact", () => {
  it("removes secrets and card numbers, keeps the rest, and recurses", () => {
    const out = redact({ id: 1, password: "x", nested: { client_secret: "s", ok: true, token: "t" }, list: [{ api_key: "k", name: "n" }], card: "4242424242424242" });
    expect(out).toEqual({ id: 1, password: "[redacted]", nested: { client_secret: "[redacted]", ok: true, token: "[redacted]" }, list: [{ api_key: "[redacted]", name: "n" }], card: "[redacted]" });
  });
  it("passes non-objects through", () => {
    expect(redact(null)).toBeNull();
    expect(redact("text")).toBe("text");
  });
});
