import { ConflictError } from "@/lib/errors";
import type { BookingStatus } from "@/types/database";

/** The status machine lives in SQL (`transition_booking`, migration 0005);
 * this is its mirror for the UI and for early validation. The two tables are
 * kept identical by src/lib/booking-state.test.ts and
 * tests/sql/03_booking_lifecycle.test.sql. */
const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["active", "cancelled", "no_show"],
  active: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "active",
  "completed",
  "cancelled",
  "no_show",
] as const satisfies readonly BookingStatus[];

/** Statuses that count as revenue in dashboards and views. */
export const REVENUE_STATUSES = ["confirmed", "active", "completed"] as const satisfies readonly BookingStatus[];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export const BOOKING_STATUS_OPTIONS: { value: BookingStatus; label: string }[] = BOOKING_STATUSES.map(
  (value) => ({ value, label: BOOKING_STATUS_LABELS[value] })
);

export function nextStatuses(from: BookingStatus): readonly BookingStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) {
    throw new ConflictError(
      `A ${BOOKING_STATUS_LABELS[from].toLowerCase()} booking cannot be changed to ${BOOKING_STATUS_LABELS[to].toLowerCase()}.`
    );
  }
}
