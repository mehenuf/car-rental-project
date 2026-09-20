/** Calendar date (year, month, day) of an instant in a time zone. */
function datePartsIn(on: Date, timeZone: string): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(on);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** Whole years between a date of birth (YYYY-MM-DD) and the calendar date of `on` in `timeZone`. */
export function ageOn(dob: string, on: Date, timeZone: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!match) throw new Error(`Invalid date of birth: ${dob}`);
  const [by, bm, bd] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const { y, m, d } = datePartsIn(on, timeZone);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

export type DriverAgeCheck = "ok" | "young_driver_band" | "too_young";

export function checkDriverAge(
  ageYears: number,
  policy: { minAge: number; youngDriverAge: number | null }
): DriverAgeCheck {
  if (ageYears < policy.minAge) return "too_young";
  if (policy.youngDriverAge !== null && ageYears < policy.youngDriverAge) return "young_driver_band";
  return "ok";
}
