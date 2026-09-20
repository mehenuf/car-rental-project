import { localDate, nextDay, startOfDayInZone } from "@/lib/provider/calendar";

export interface OverviewBooking {
  status: string;
  payment_status: string;
  created_at: string;
  pickup_at: string;
  dropoff_at: string;
  /** The provider's share of the accepted quote (from the booking's price snapshot). */
  providerPayoutMinor: number;
}

export interface OverviewSummary {
  bookingsThisMonth: number;
  earningsThisMonthMinor: number;
  pickupsToday: number;
  returnsToday: number;
}

const DEAD = new Set(["cancelled", "no_show"]);

/** The headline numbers for the portal overview, in the provider's time zone. */
export function summarizeBookings(bookings: readonly OverviewBooking[], now: Date, timeZone: string): OverviewSummary {
  const today = localDate(now, timeZone);
  const todayStart = startOfDayInZone(today, timeZone);
  const tomorrowStart = startOfDayInZone(nextDay(today), timeZone);
  const monthStart = startOfDayInZone(`${today.slice(0, 7)}-01`, timeZone);

  const within = (iso: string, from: Date, to: Date) => {
    const t = new Date(iso).getTime();
    return t >= from.getTime() && t < to.getTime();
  };

  let bookingsThisMonth = 0;
  let earningsThisMonthMinor = 0;
  let pickupsToday = 0;
  let returnsToday = 0;

  for (const b of bookings) {
    if (DEAD.has(b.status)) continue;
    if (new Date(b.created_at) >= monthStart) {
      bookingsThisMonth++;
      if (b.payment_status === "paid" || b.payment_status === "partially_refunded") earningsThisMonthMinor += b.providerPayoutMinor;
    }
    if (["pending", "confirmed"].includes(b.status) && within(b.pickup_at, todayStart, tomorrowStart)) pickupsToday++;
    if (["confirmed", "active"].includes(b.status) && within(b.dropoff_at, todayStart, tomorrowStart)) returnsToday++;
  }
  return { bookingsThisMonth, earningsThisMonthMinor, pickupsToday, returnsToday };
}

/** Occupied time as a percentage of the time all cars could have been booked, capped at 100. */
export function utilisationPercent(occupiedMs: number, units: number, windowMs: number): number {
  if (units <= 0 || windowMs <= 0) return 0;
  return Math.min(100, Math.round((occupiedMs / (units * windowMs)) * 100));
}
