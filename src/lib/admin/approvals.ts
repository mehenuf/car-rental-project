import { currencyExponent } from "@/lib/pricing/money";
import type { StaffRole } from "./permissions";

export type ApprovalKind = "refund" | "dispute_decision" | "payout_release" | "fee_change";

/** What each role may refund or decide alone, in whole currency units (converted per currency). */
const LIMIT_MAJOR: Record<StaffRole, number> = {
  support: 100,
  reviewer: 100,
  finance: 1000,
  super_admin: 10_000,
};

export function thresholdMinor(role: StaffRole, currency: string): number {
  return LIMIT_MAJOR[role] * 10 ** currencyExponent(currency);
}

/** Payout release and fee changes always need a second person; refunds and dispute decisions above the role's limit do. */
export function needsApproval(input: { kind: ApprovalKind; role: StaffRole; amountMinor: number; currency: string }): boolean {
  if (input.kind === "payout_release" || input.kind === "fee_change") return true;
  return input.amountMinor > thresholdMinor(input.role, input.currency);
}

/** Mirrors `decide_approval`: finance or a super admin, and never the person who asked. */
export function canApprove(input: { deciderRole: StaffRole | null; deciderId: string; requesterId: string }): boolean {
  return (input.deciderRole === "finance" || input.deciderRole === "super_admin") && input.deciderId !== input.requesterId;
}
