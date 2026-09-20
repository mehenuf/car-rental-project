export const DEFAULT_TIME = "10:00";

/** Half-hour slots from 06:00 to 20:00 as "HH:MM" (24 hour, language independent). */
export const TIME_SLOTS: string[] = Array.from({ length: 29 }, (_, i) => {
  const minutes = 6 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

/** Accepts "14:30", "2:30 PM" or "02:30 pm" and returns "HH:MM", or null when it is not a time. */
export function parseTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^\s*(\d{1,2}):(\d{2})\s*(am|pm)?\s*$/i.exec(value);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3]?.toLowerCase();
  if (period) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (period === "pm" ? 12 : 0);
  }
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** The chosen day at the chosen time, in the visitor's own time zone. */
export function combineDateAndTime(date: Date, time: string): Date {
  const parsed = parseTime(time) ?? DEFAULT_TIME;
  const [h, m] = parsed.split(":").map(Number) as [number, number];
  const result = new Date(date);
  result.setHours(h, m, 0, 0);
  return result;
}

/** A slot such as "14:30" written for the visitor's language ("2:30 PM", "14:30"). */
export function formatSlot(time: string, locale: string): string {
  const parsed = parseTime(time) ?? DEFAULT_TIME;
  const [h, m] = parsed.split(":").map(Number) as [number, number];
  const d = new Date(2000, 0, 1, h, m);
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(d);
}

/** The earliest slot that is still in the future on a given day (all slots for later days). */
export function firstAvailableSlot(date: Date, now: Date = new Date()): string {
  const sameDay = date.toDateString() === now.toDateString();
  if (!sameDay) return TIME_SLOTS[0]!;
  return TIME_SLOTS.find((slot) => combineDateAndTime(date, slot) > now) ?? TIME_SLOTS[TIME_SLOTS.length - 1]!;
}

/** A sensible first trip: the next free slot today (or tomorrow morning if today is over), for one day. */
export function defaultTrip(now: Date = new Date()): { pickupDate: Date; pickupTime: string; dropoffDate: Date; dropoffTime: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const slot = firstAvailableSlot(today, now);
  const todayLeft = combineDateAndTime(today, slot) > now;
  const pickupDate = todayLeft ? today : new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const pickupTime = todayLeft ? slot : TIME_SLOTS[0]!;
  const dropoffDate = new Date(pickupDate.getFullYear(), pickupDate.getMonth(), pickupDate.getDate() + 1);
  return { pickupDate, pickupTime, dropoffDate, dropoffTime: pickupTime };
}
