export const QUIET_START_HOUR = 21;
export const QUIET_END_HOUR = 8;

interface LocalParts {
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
}

function localParts(at: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute") };
}

/** The UTC instant at which the wall clock in `timeZone` reads the given local time. */
function zonedToUtc(y: number, m: number, d: number, h: number, min: number, timeZone: string): Date {
  const wanted = Date.UTC(y, m - 1, d, h, min);
  let guess = wanted;
  // Two passes settle the offset even when the guess lands on the other side of a DST change.
  for (let i = 0; i < 2; i++) {
    const p = localParts(new Date(guess), timeZone);
    const seen = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
    guess += wanted - seen;
  }
  return new Date(guess);
}

/** Nothing is sent by SMS or push between 21:00 and 08:00 in the recipient's local time. */
export function isQuietHour(at: Date, timeZone: string): boolean {
  const { h } = localParts(at, timeZone);
  return h >= QUIET_START_HOUR || h < QUIET_END_HOUR;
}

/** `at` itself when it is a good time, otherwise the next 08:00 local time. */
export function nextAllowedTime(at: Date, timeZone: string): Date {
  const p = localParts(at, timeZone);
  if (p.h >= QUIET_START_HOUR) {
    const next = new Date(Date.UTC(p.y, p.m - 1, p.d) + 24 * 3_600_000);
    return zonedToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), QUIET_END_HOUR, 0, timeZone);
  }
  if (p.h < QUIET_END_HOUR) {
    return zonedToUtc(p.y, p.m, p.d, QUIET_END_HOUR, 0, timeZone);
  }
  return at;
}
