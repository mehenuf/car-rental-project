export interface CurrencyTotal {
  currency: string;
  total: number;
}

/** Sums per currency, never across currencies. Sorted by currency code. */
export function groupByCurrency<T extends { currency: string }>(rows: T[], amount: (row: T) => number): CurrencyTotal[] {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.currency, (totals.get(row.currency) ?? 0) + amount(row));
  return [...totals.entries()].map(([currency, total]) => ({ currency, total })).sort((a, b) => a.currency.localeCompare(b.currency));
}

export interface FxRate {
  date: string;
  base: string;
  quote: string;
  rate: number;
}

/**
 * An indicative total in one currency for a dashboard line, always labelled as approximate. Uses the
 * latest rate for each pair (or its inverse) and says which currencies had no rate. Nothing in the
 * ledger, payouts or receipts ever uses this.
 */
export function approxTotal(
  groups: CurrencyTotal[],
  target: string,
  rates: FxRate[]
): { ok: true; totalMinor: number } | { ok: false; missing: string[] } {
  let total = 0;
  const missing: string[] = [];
  for (const g of groups) {
    if (g.currency === target) {
      total += g.total;
      continue;
    }
    const direct = rates.filter((r) => r.base === g.currency && r.quote === target).sort((a, b) => b.date.localeCompare(a.date))[0];
    const inverse = rates.filter((r) => r.base === target && r.quote === g.currency).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (direct) total += Math.round(g.total * direct.rate);
    else if (inverse) total += Math.round(g.total / inverse.rate);
    else missing.push(g.currency);
  }
  return missing.length ? { ok: false, missing } : { ok: true, totalMinor: total };
}
