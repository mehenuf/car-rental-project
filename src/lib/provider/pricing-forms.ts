import { majorToMinor, minorToMajor } from "@/lib/pricing/money";
import { nextDay } from "@/lib/provider/calendar";

/** People type percentages and money; the database stores basis points and minor units. */
export const pctToBp = (pct: number): number => Math.round(pct * 100);
export const bpToPct = (bp: number): number => bp / 100;

export interface PolicyForm {
  deposit_type: "fixed" | "percent";
  /** Major units of the currency when fixed, a percentage when percent. */
  deposit_value: number;
  cancellation_tiers: { hours_before: number; refund_pct: number }[];
  min_driver_age: number;
  young_driver_age: number | null;
  /** Major units per day. */
  young_driver_fee: number;
}

export interface PolicyRow {
  deposit_type: "fixed" | "percent";
  deposit_value: number;
  cancellation_tiers: { hours_before: number; refund_bp: number }[];
  min_driver_age: number;
  young_driver_age: number | null;
  young_driver_fee_minor: number;
}

export function policyFormToRow(form: PolicyForm, currency: string): PolicyRow {
  return {
    deposit_type: form.deposit_type,
    deposit_value: form.deposit_type === "fixed" ? majorToMinor(form.deposit_value, currency) : pctToBp(form.deposit_value),
    // Stored earliest deadline first, the order the refund calculation and the customer text expect.
    cancellation_tiers: [...form.cancellation_tiers]
      .sort((a, b) => b.hours_before - a.hours_before)
      .map((t) => ({ hours_before: t.hours_before, refund_bp: pctToBp(t.refund_pct) })),
    min_driver_age: form.min_driver_age,
    young_driver_age: form.young_driver_age,
    young_driver_fee_minor: majorToMinor(form.young_driver_fee, currency),
  };
}

export function policyRowToForm(row: PolicyRow, currency: string): PolicyForm {
  return {
    deposit_type: row.deposit_type,
    deposit_value: row.deposit_type === "fixed" ? minorToMajor(row.deposit_value, currency) : bpToPct(row.deposit_value),
    cancellation_tiers: row.cancellation_tiers.map((t) => ({ hours_before: t.hours_before, refund_pct: bpToPct(t.refund_bp) })),
    min_driver_age: row.min_driver_age,
    young_driver_age: row.young_driver_age,
    young_driver_fee: minorToMajor(row.young_driver_fee_minor, currency),
  };
}

/** Inclusive first and last day -> a Postgres daterange text (the end is stored exclusive). */
export function dateRangeInclusive(startDate: string, endDate: string): string {
  return `[${startDate},${nextDay(endDate)})`;
}

/** `[2030-07-01,2030-08-01)` -> the inclusive dates a person entered. */
export function parseSeasonRange(text: string): { start_date: string; end_date: string } {
  const match = /^[[(](\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})[\])]$/.exec(text);
  if (!match) throw new Error(`Unrecognised daterange: ${text}`);
  const end = new Date(Date.parse(match[2]!) - 86_400_000).toISOString().slice(0, 10);
  return { start_date: match[1]!, end_date: end };
}
