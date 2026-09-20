interface Difference {
  currency: string;
  difference_minor: number;
}

export interface ReconciliationProblem {
  check: "trial_balance" | "payments" | "payouts";
  currency: string;
  differenceMinor: number;
}

/** Every non-zero difference from the three ledger checks, named by check and currency. */
export function reconciliationProblems(input: { trial: Difference[]; payments: Difference[]; payouts: Difference[] }): ReconciliationProblem[] {
  const out: ReconciliationProblem[] = [];
  for (const [check, rows] of [["trial_balance", input.trial], ["payments", input.payments], ["payouts", input.payouts]] as const) {
    for (const r of rows) if (r.difference_minor !== 0) out.push({ check, currency: r.currency, differenceMinor: r.difference_minor });
  }
  return out;
}
