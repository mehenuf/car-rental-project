import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { approxTotal, groupByCurrency } from "@/lib/admin/currency";
import { reconciliationProblems } from "@/lib/admin/reconcile";
import { requireStaff } from "@/lib/admin/staff";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * GET /api/admin/reports[?approx=USD] — revenue, volume, refunds, payouts and tax, always grouped by
 * currency, plus the three ledger integrity checks. `approx` adds an indicative total in one currency
 * from the manual FX table; it is labelled approximate and used nowhere else.
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  await requireStaff("reports.read");
  const [revenue, gmv, refunds, payouts, tax, trial, payments, payoutCheck, fx] = await Promise.all([
    supabaseAdmin.from("v_revenue_by_month_currency").select("*").order("month", { ascending: false }).limit(60),
    supabaseAdmin.from("v_gmv_take_rate").select("*").order("month", { ascending: false }).limit(60),
    supabaseAdmin.from("v_refunds_by_month").select("*").order("month", { ascending: false }).limit(60),
    supabaseAdmin.from("v_payouts_by_provider").select("currency, status, amount_minor, payouts"),
    supabaseAdmin.from("v_tax_collected_by_country").select("*"),
    supabaseAdmin.rpc("fn_trial_balance"),
    supabaseAdmin.rpc("fn_reconcile_payments"),
    supabaseAdmin.rpc("fn_reconcile_payouts"),
    supabaseAdmin.from("fx_rates").select("date, base, quote, rate"),
  ]);
  for (const r of [revenue, gmv, refunds, payouts, tax, trial, payments, payoutCheck, fx]) {
    if (r.error) throw new Error(`reports: ${r.error.message}`);
  }

  const revenueTotals = groupByCurrency(revenue.data ?? [], (r) => r.revenue_minor);
  const target = request.nextUrl.searchParams.get("approx")?.toUpperCase();
  const approximate = target && /^[A-Z]{3}$/.test(target) ? { currency: target, ...approxTotal(revenueTotals, target, (fx.data ?? []).map((r) => ({ ...r, rate: Number(r.rate) }))) } : null;

  return NextResponse.json({
    revenue: revenue.data,
    revenueTotals,
    volume: gmv.data,
    refunds: refunds.data,
    payouts: groupByCurrency(
      (payouts.data ?? []).map((p) => ({ currency: p.currency, amount: p.amount_minor, status: p.status })),
      (p) => p.amount
    ),
    payoutsByStatus: payouts.data,
    tax: tax.data,
    integrity: {
      trialBalance: trial.data,
      payments: payments.data,
      payouts: payoutCheck.data,
      problems: reconciliationProblems({ trial: trial.data ?? [], payments: payments.data ?? [], payouts: payoutCheck.data ?? [] }),
    },
    approximate,
  });
});
