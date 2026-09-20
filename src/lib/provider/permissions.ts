export type ProviderRole = "owner" | "manager" | "agent";

export type ProviderAction =
  | "provider.read"
  | "fleet.write"
  | "availability.write"
  | "pricing.write"
  | "bookings.read"
  | "bookings.operate"
  | "payouts.read"
  | "team.manage"
  | "documents.write"
  | "payout_account.write";

const ALL: readonly ProviderAction[] = [
  "provider.read",
  "fleet.write",
  "availability.write",
  "pricing.write",
  "bookings.read",
  "bookings.operate",
  "payouts.read",
  "team.manage",
  "documents.write",
  "payout_account.write",
];

/** Owners can do everything; managers everything except team and payout-account management; agents only read and run bookings. */
const MATRIX: Record<ProviderRole, ReadonlySet<ProviderAction>> = {
  owner: new Set(ALL),
  manager: new Set(ALL.filter((a) => a !== "team.manage" && a !== "payout_account.write")),
  agent: new Set<ProviderAction>(["provider.read", "bookings.read", "bookings.operate"]),
};

export function can(role: ProviderRole, action: ProviderAction): boolean {
  return MATRIX[role]?.has(action) ?? false;
}

/** A member scoped to one branch may only touch that branch; a member without a scope may touch all of them. */
export function canAccessBranch(member: { branchId: number | null }, branchId: number): boolean {
  return member.branchId === null || member.branchId === branchId;
}
