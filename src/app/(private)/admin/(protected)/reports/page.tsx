"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApiData } from "@/hooks/use-api-data";
import { formatMinor } from "@/lib/pricing/money";

interface Report {
  revenue: { month: string; currency: string; revenue_minor: number }[];
  revenueTotals: { currency: string; total: number }[];
  volume: { month: string; currency: string; gmv_minor: number; revenue_minor: number; take_rate_bp: number }[];
  refunds: { month: string; currency: string; refunded_minor: number; refunds: number }[];
  payoutsByStatus: { currency: string; status: string; amount_minor: number; payouts: number }[];
  tax: { country_code: string; currency: string; tax_minor: number }[];
  integrity: {
    trialBalance: { currency: string; debit_minor: number; credit_minor: number; difference_minor: number }[];
    problems: { check: string; currency: string; differenceMinor: number }[];
  };
  approximate: { currency: string; ok: boolean; totalMinor?: number; missing?: string[] } | null;
}

const EXPORT_KINDS = ["bookings", "payments", "refunds", "payouts", "ledger", "tax", "providers", "audit"];

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nothing yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-start text-muted-foreground">{head.map((h) => <th key={h} className="py-1 pe-3 text-start font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => <tr key={i} className="border-b border-border last:border-0">{r.map((c, j) => <td key={j} className="py-1.5 pe-3">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminReportsPage() {
  const [approx, setApprox] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const result = useApiData<Report>(`/api/admin/reports${approx ? `?approx=${approx}` : ""}`);
  const data = result.status === "success" ? result.data : null;
  const m = (minor: number, currency: string) => formatMinor(minor, currency);

  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">Every figure is shown per currency. Different currencies are never added together, except in the labelled approximate line below.</p>
      </div>
      {result.status === "loading" && <p className="text-sm text-muted-foreground">Loading...</p>}
      {result.status === "error" && <p className="text-sm text-destructive">{result.error}</p>}

      {data && (
        <>
          <Card className="shadow-card ring-0">
            <CardContent className="flex flex-col gap-2">
              <h2 className="font-heading text-base font-semibold text-foreground">Ledger integrity</h2>
              {data.integrity.problems.length === 0 ? (
                <p className="text-sm text-success-text">Every check balances: trial balance, payments against the ledger, and payouts against the ledger.</p>
              ) : (
                <ul className="text-sm text-destructive">
                  {data.integrity.problems.map((p) => <li key={`${p.check}-${p.currency}`}>{p.check.replace("_", " ")} is off by {m(p.differenceMinor, p.currency)} ({p.currency}).</li>)}
                </ul>
              )}
              <Table head={["Currency", "Debits", "Credits", "Difference"]} rows={data.integrity.trialBalance.map((r) => [r.currency, m(r.debit_minor, r.currency), m(r.credit_minor, r.currency), m(r.difference_minor, r.currency)])} />
            </CardContent>
          </Card>

          <Card className="shadow-card ring-0">
            <CardContent className="flex flex-col gap-2">
              <h2 className="font-heading text-base font-semibold text-foreground">Platform revenue</h2>
              <Table head={["Month", "Currency", "Revenue"]} rows={data.revenue.map((r) => [r.month, r.currency, m(r.revenue_minor, r.currency)])} />
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Approximate total in</span>
                <Input aria-label="Currency code" value={approx} onChange={(e) => setApprox(e.target.value.toUpperCase().slice(0, 3))} placeholder="USD" className="w-20" />
                {data.approximate?.ok && data.approximate.totalMinor !== undefined && <span>≈ {m(data.approximate.totalMinor, data.approximate.currency)} (indicative, from manually entered rates)</span>}
                {data.approximate && !data.approximate.ok && <span className="text-destructive">No rate for {data.approximate.missing?.join(", ")}. Add one under Settings.</span>}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card ring-0">
            <CardContent className="flex flex-col gap-2">
              <h2 className="font-heading text-base font-semibold text-foreground">Volume and take rate</h2>
              <Table head={["Month", "Currency", "Charged", "Revenue", "Take rate"]} rows={data.volume.map((r) => [r.month, r.currency, m(r.gmv_minor, r.currency), m(r.revenue_minor, r.currency), `${(r.take_rate_bp / 100).toFixed(2)}%`])} />
            </CardContent>
          </Card>

          <Card className="shadow-card ring-0">
            <CardContent className="flex flex-col gap-2">
              <h2 className="font-heading text-base font-semibold text-foreground">Refunds and payouts</h2>
              <Table head={["Month", "Currency", "Refunded", "Count"]} rows={data.refunds.map((r) => [r.month, r.currency, m(r.refunded_minor, r.currency), r.refunds])} />
              <Table head={["Currency", "Payout status", "Amount", "Count"]} rows={data.payoutsByStatus.map((r) => [r.currency, r.status, m(r.amount_minor, r.currency), r.payouts])} />
            </CardContent>
          </Card>

          <Card className="shadow-card ring-0">
            <CardContent className="flex flex-col gap-2">
              <h2 className="font-heading text-base font-semibold text-foreground">Tax collected by country</h2>
              <Table head={["Country", "Currency", "Tax added to totals"]} rows={data.tax.map((r) => [r.country_code, r.currency, m(r.tax_minor, r.currency)])} />
            </CardContent>
          </Card>
        </>
      )}

      <Card className="shadow-card ring-0">
        <CardContent className="flex flex-col gap-2">
          <h2 className="font-heading text-base font-semibold text-foreground">CSV exports</h2>
          <p className="text-xs text-muted-foreground">Up to one year at a time. Each export is checked against your role and recorded in the audit log.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Input aria-label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            <Input aria-label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          <div className="flex flex-wrap gap-2">
            {EXPORT_KINDS.map((k) => (
              <Button key={k} type="button" size="sm" variant="outline" render={<a href={`/api/admin/exports/${k}?from=${from}&to=${to}`} download />}>
                {k}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
