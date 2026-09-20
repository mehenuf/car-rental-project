export type LicenceStatus = "unverified" | "pending" | "verified" | "rejected" | "expired";
export type LicenceActor = "customer" | "reviewer" | "system";

const TRANSITIONS: { from: LicenceStatus[]; to: LicenceStatus; actor: LicenceActor }[] = [
  { from: ["unverified", "rejected", "expired"], to: "pending", actor: "customer" },
  { from: ["pending"], to: "verified", actor: "reviewer" },
  { from: ["pending"], to: "rejected", actor: "reviewer" },
  { from: ["verified"], to: "expired", actor: "system" },
];

export function canTransition(from: LicenceStatus, to: LicenceStatus, actor: LicenceActor): boolean {
  return TRANSITIONS.some((t) => t.to === to && t.actor === actor && t.from.includes(from));
}

/** A licence counts only when verified and still valid on the last day of the rental. */
export function isLicenceValidOn(
  profile: { status: LicenceStatus; licenceExpiry: string | null },
  on: Date,
  rentalEnd: Date
): boolean {
  if (profile.status !== "verified" || !profile.licenceExpiry) return false;
  const expiryEnd = new Date(`${profile.licenceExpiry}T23:59:59Z`);
  return expiryEnd >= on && expiryEnd >= rentalEnd;
}
