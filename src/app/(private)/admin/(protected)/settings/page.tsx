"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApiData } from "@/hooks/use-api-data";
import { LoadingBlock } from "@/components/admin/loading-block";
import { formatDate } from "@/lib/format";

interface Settings {
  settings: { commission_bp: number; service_fee_bp: number } | null;
  history: { id: number; changed_at: string; before: Record<string, number>; after: Record<string, number> }[];
  pending: { id: string; payload: Record<string, unknown> }[];
}

const pct = (bp: number) => `${(bp / 100).toFixed(2)}%`;

export default function AdminSettingsPage() {
  const [refresh, setRefresh] = useState(0);
  const [commission, setCommission] = useState("");
  const [serviceFee, setServiceFee] = useState("");
  const [reason, setReason] = useState("");
  const [fx, setFx] = useState({ date: "", base: "", quote: "", rate: "" });
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const result = useApiData<Settings>(`/api/admin/settings?_r=${refresh}`);
  const data = result.status === "success" ? result.data : null;

  async function send(url: string, body: unknown, ok: string) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => null);
    if (!res.ok) return setMessage({ text: json?.error?.message ?? "Something went wrong.", ok: false });
    setMessage({ text: ok, ok: true });
    setRefresh((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">Platform settings</h1>
        <p className="text-sm text-muted-foreground">Fee changes are never applied directly. They go to Approvals, need a second person, and are kept in a history with an audit entry.</p>
      </div>
      {message && <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-success-text" : "text-destructive"}`}>{message.text}</p>}
      {result.status === "error" && <p className="text-sm text-destructive">{result.error}</p>}
      {result.status === "loading" && <LoadingBlock />}

      {data?.settings && (
        <Card className="shadow-card ring-0">
          <CardContent className="flex flex-col gap-2">
            <h2 className="font-heading text-base font-semibold text-foreground">Fees</h2>
            <p className="text-sm text-foreground">Commission {pct(data.settings.commission_bp)} · service fee {pct(data.settings.service_fee_bp)}</p>
            {data.pending.length > 0 ? (
              <p className="text-sm text-muted-foreground">A change is waiting for approval.</p>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <Input aria-label="New commission in percent" placeholder="Commission %" type="number" min="0" max="100" step="0.01" value={commission} onChange={(e) => setCommission(e.target.value)} className="w-36" />
                <Input aria-label="New service fee in percent" placeholder="Service fee %" type="number" min="0" max="100" step="0.01" value={serviceFee} onChange={(e) => setServiceFee(e.target.value)} className="w-36" />
                <Input aria-label="Reason" placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} className="min-w-56 flex-1" />
                <Button
                  type="button"
                  size="sm"
                  disabled={!reason.trim() || (!commission && !serviceFee)}
                  onClick={() => void send("/api/admin/settings", { commission_bp: commission ? Math.round(Number(commission) * 100) : undefined, service_fee_bp: serviceFee ? Math.round(Number(serviceFee) * 100) : undefined, reason }, "Sent for approval.")}
                >
                  Ask for approval
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card ring-0">
        <CardContent className="flex flex-col gap-2">
          <h2 className="font-heading text-base font-semibold text-foreground">Exchange rates (reports only)</h2>
          <p className="text-xs text-muted-foreground">Used only for the labelled approximate totals in Reports. Never for prices, payments, payouts or receipts.</p>
          <div className="flex flex-wrap items-end gap-2">
            <Input aria-label="Date" type="date" value={fx.date} onChange={(e) => setFx({ ...fx, date: e.target.value })} className="w-40" />
            <Input aria-label="From currency" placeholder="EUR" maxLength={3} value={fx.base} onChange={(e) => setFx({ ...fx, base: e.target.value.toUpperCase() })} className="w-20" />
            <Input aria-label="To currency" placeholder="USD" maxLength={3} value={fx.quote} onChange={(e) => setFx({ ...fx, quote: e.target.value.toUpperCase() })} className="w-20" />
            <Input aria-label="Rate" placeholder="1.10" type="number" step="0.00000001" value={fx.rate} onChange={(e) => setFx({ ...fx, rate: e.target.value })} className="w-32" />
            <Button type="button" size="sm" disabled={!fx.date || fx.base.length !== 3 || fx.quote.length !== 3 || !fx.rate} onClick={() => void send("/api/admin/fx", { ...fx, rate: Number(fx.rate) }, "Rate saved.")}>Save rate</Button>
          </div>
        </CardContent>
      </Card>

      {data && data.history.length > 0 && (
        <Card className="shadow-card ring-0">
          <CardContent className="flex flex-col gap-1">
            <h2 className="font-heading text-base font-semibold text-foreground">History</h2>
            {data.history.map((h) => (
              <p key={h.id} className="text-sm text-muted-foreground">
                {formatDate(h.changed_at)}: commission {pct(h.before.commission_bp ?? 0)} to {pct(h.after.commission_bp ?? 0)}, service fee {pct(h.before.service_fee_bp ?? 0)} to {pct(h.after.service_fee_bp ?? 0)}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
