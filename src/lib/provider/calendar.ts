export type CellState = "free" | "booking" | "transfer" | "maintenance" | "owner_block" | "unavailable";

/** Milliseconds the zone is ahead of UTC at `instant` (negative for the Americas). */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asIfUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant a calendar day (`YYYY-MM-DD`) starts in `timeZone`, correct across daylight saving changes. */
export function startOfDayInZone(dateStr: string, timeZone: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d);
  // The first pass uses the offset at the guess; the second re-checks it at the candidate so a DST change in between is handled.
  const first = guess - zoneOffsetMs(new Date(guess), timeZone);
  return new Date(guess - zoneOffsetMs(new Date(first), timeZone));
}

/** The local date (`YYYY-MM-DD`) of an instant in `timeZone`. */
export function localDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

export function nextDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Every date of a month given as `YYYY-MM`. */
export function monthDays(month: string): string[] {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

const PRIORITY: CellState[] = ["booking", "transfer", "maintenance", "owner_block"];

/**
 * One car's row of the calendar: what each day is. Anything occupying part of a
 * day marks it (a booking wins over maintenance, which wins over an owner
 * block). A car that is only bookable inside owner-set windows (`windows` not
 * null) shows the days outside every window as unavailable.
 */
export function buildUnitRow(
  days: string[],
  timeZone: string,
  occupancy: { reason: "booking" | "transfer" | "maintenance" | "owner_block"; start: Date; end: Date }[],
  windows: { start: Date; end: Date }[] | null
): CellState[] {
  return days.map((day) => {
    const start = startOfDayInZone(day, timeZone);
    const end = startOfDayInZone(nextDay(day), timeZone);

    const hits = new Set(occupancy.filter((o) => o.start < end && o.end > start).map((o) => o.reason));
    for (const reason of PRIORITY) if (hits.has(reason as never)) return reason;

    if (windows !== null && !windows.some((w) => w.start <= start && w.end >= end)) return "unavailable";
    return "free";
  });
}
