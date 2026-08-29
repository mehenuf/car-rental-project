export interface DateRange {
  from: Date;
  to: Date;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Formats a date as `YYYY-MM-DD` in local time, for the `/api/stats`-style query params. */
export function toApiDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function lastNDays(n: number): DateRange {
  const to = endOfDay(new Date());
  const from = startOfDay(new Date());
  from.setDate(from.getDate() - (n - 1));
  return { from, to };
}

export function today(): DateRange {
  return { from: startOfDay(new Date()), to: endOfDay(new Date()) };
}

export function thisYear(): DateRange {
  const now = new Date();
  return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) };
}

export function defaultDateRange(): DateRange {
  return lastNDays(30);
}

/** The immediately preceding period of the same length — mirrors the
 * comparison window `getDashboardStats` computes server-side. */
export function previousPeriod(range: DateRange): DateRange {
  const lengthMs = range.to.getTime() - range.from.getTime();
  const to = new Date(range.from.getTime() - 24 * 60 * 60 * 1000);
  const from = new Date(to.getTime() - lengthMs);
  return { from, to };
}

export function formatRangeLabel(range: DateRange): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
  return `${fmt(range.from)} - ${fmt(range.to)}`;
}
