const DAY_MS = 24 * 60 * 60 * 1000;
const GRACE_MS = 59 * 60 * 1000;

/** Billable rental days: whole 24 hour periods rounded up after a 59 minute
 * grace, minimum 1. Must match the `bookings.days` generated column
 * (migration 0008): `greatest(1, ceil((epoch - 3540) / 86400))`. */
export function billableDays(pickupAt: string | Date, dropoffAt: string | Date): number {
  const diffMs = new Date(dropoffAt).getTime() - new Date(pickupAt).getTime();
  return Math.max(1, Math.ceil((diffMs - GRACE_MS) / DAY_MS));
}
