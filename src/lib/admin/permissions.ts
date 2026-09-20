export const ROLES = ["super_admin", "support", "finance", "reviewer"] as const;
export type StaffRole = (typeof ROLES)[number];

export const PERMISSIONS = [
  "providers.review",
  "cars.review",
  "licences.review",
  "documents.review",
  "reviews.moderate",
  "reports.handle",
  "risk.clear",
  "disputes.decide",
  "customers.read",
  "bookings.read",
  "bookings.cancel",
  "users.suspend",
  "payments.read",
  "refunds.issue",
  "payouts.manage",
  "ledger.read",
  "reports.read",
  "exports.run",
  "fees.manage",
  "tax.manage",
  "audit.read",
  "staff.manage",
  "settings.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const REVIEWER: Permission[] = ["providers.review", "cars.review", "licences.review", "documents.review", "reviews.moderate", "reports.handle", "risk.clear", "disputes.decide"];
const SUPPORT: Permission[] = ["customers.read", "bookings.read", "bookings.cancel", "refunds.issue", "disputes.decide", "users.suspend"];
const FINANCE: Permission[] = ["payments.read", "bookings.read", "refunds.issue", "payouts.manage", "ledger.read", "reports.read", "exports.run", "fees.manage", "tax.manage", "disputes.decide"];

const MATRIX: Record<StaffRole, ReadonlySet<Permission>> = {
  super_admin: new Set(PERMISSIONS),
  reviewer: new Set(REVIEWER),
  support: new Set(SUPPORT),
  finance: new Set(FINANCE),
};

export function can(role: StaffRole | null | undefined, permission: Permission): boolean {
  return role ? (MATRIX[role]?.has(permission) ?? false) : false;
}

export function permissionsFor(role: StaffRole | null | undefined): Permission[] {
  return role && MATRIX[role] ? [...MATRIX[role]] : [];
}
