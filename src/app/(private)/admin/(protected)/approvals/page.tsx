"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApiData } from "@/hooks/use-api-data";
import { canApprove } from "@/lib/admin/approvals";
import type { StaffRole } from "@/lib/admin/permissions";
import { formatDate } from "@/lib/format";
import { formatMinor } from "@/lib/pricing/money";

interface Approval {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  amount_minor: number | null;
  currency: string | null;
  requested_by: string;
  requested_at: string;
  status: string;
  note: string | null;
}

export default function AdminApprovalsPage() {
  const [refresh, setRefresh] = useState(0);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const result = useApiData<{ pending: Approval[]; recent: Approval[]; me: { userId: string; role: StaffRole } }>(`/api/admin/approvals?_r=${refresh}`);
  const data = result.status === "success" ? result.data : null;

  async function decide(id: string, approve: boolean) {
    setMessage(null);
    const res = await fetch("/api/admin/approvals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, approve, note: note || undefined }) });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setMessage(json?.error?.message ?? "Something went wrong.");
      return;
    }
    setNote("");
    setRefresh((n) => n + 1);
  }

  const describe = (a: Approval) =>
    a.kind === "fee_change"
      ? `Change fees: ${Object.entries(a.payload).filter(([k, v]) => k !== "reason" && v !== undefined && v !== null).map(([k, v]) => `${k.replace("_bp", "")} to ${(Number(v) / 100).toFixed(2)}%`).join(", ")}`
      : `${a.kind.replace("_", " ")}${a.amount_minor !== null && a.currency ? ` of ${formatMinor(a.amount_minor, a.currency)}` : ""}`;

  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">Approvals</h1>
        <p className="text-sm text-muted-foreground">Fee changes, payout releases, and refunds or dispute decisions above a role&apos;s limit need a second person from finance or a super admin. Nobody can decide their own request.</p>
      </div>
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      {result.status === "error" && <p className="text-sm text-destructive">{result.error}</p>}
      {data && data.pending.length === 0 && <p className="text-sm text-muted-foreground">Nothing is waiting.</p>}
      {data?.pending.map((a) => {
        const allowed = canApprove({ deciderRole: data.me.role, deciderId: data.me.userId, requesterId: a.requested_by });
        return (
          <Card key={a.id} className="shadow-card ring-0">
            <CardContent className="flex flex-col gap-2">
              <p className="text-sm font-medium text-foreground">{describe(a)}</p>
              <p className="text-xs text-muted-foreground">Requested {formatDate(a.requested_at)}{a.payload.reason ? ` · ${String(a.payload.reason)}` : ""}{a.payload.note ? ` · ${String(a.payload.note)}` : ""}</p>
              {allowed ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Input aria-label="Note" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} className="max-w-xs" />
                  <Button type="button" size="sm" onClick={() => void decide(a.id, true)}>Approve</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void decide(a.id, false)}>Reject</Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{a.requested_by === data.me.userId ? "You asked for this; someone else must decide." : "Only finance or a super admin can decide."}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
      {data && data.recent.length > 0 && (
        <>
          <h2 className="font-heading text-lg font-semibold text-foreground">Recently decided</h2>
          {data.recent.map((a) => (
            <p key={a.id} className="text-sm text-muted-foreground">{describe(a)} · {a.status}{a.note ? ` · ${a.note}` : ""}</p>
          ))}
        </>
      )}
    </div>
  );
}
