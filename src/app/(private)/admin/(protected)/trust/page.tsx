"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApiData } from "@/hooks/use-api-data";
import { formatDate } from "@/lib/format";
import { formatMinor } from "@/lib/pricing/money";

interface Data {
  disputes: { id: string; booking_id: string; type: string; claimed_amount_minor: number | null; offer_minor: number | null; currency: string; opened_by_side: string; created_at: string }[];
  reports: { id: string; kind: string; target_id: string; reason: string; created_at: string }[];
  held: { id: string; reference: string; total_amount: number; currency: string | null; risk_flags: string[]; pickup_at: string }[];
}

async function act(body: Record<string, unknown>): Promise<string | null> {
  const res = await fetch("/api/admin/trust", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.ok) return null;
  const json = await res.json().catch(() => null);
  return json?.error?.message ?? "Something went wrong.";
}

function DisputeRow({ d, onDone, setMessage }: { d: Data["disputes"][number]; onDone: () => void; setMessage: (m: string | null) => void }) {
  const [amount, setAmount] = useState(String((d.offer_minor ?? d.claimed_amount_minor ?? 0) / 100));
  const [note, setNote] = useState("");
  const decide = async (resolution: "capture" | "refund" | "dismiss") => {
    const error = await act({
      action: "decide_dispute",
      dispute_id: d.id,
      resolution,
      amount_minor: resolution === "dismiss" ? undefined : Math.round(Number(amount) * 100),
      note,
    });
    setMessage(error);
    if (!error) onDone();
  };
  return (
    <Card className="shadow-card ring-0">
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm text-foreground">
          {d.type.replace("_", " ")} · opened by the {d.opened_by_side} on {formatDate(d.created_at)} · claimed{" "}
          {d.claimed_amount_minor !== null ? formatMinor(d.claimed_amount_minor, d.currency) : "no amount"}
          {d.offer_minor !== null ? ` · last offer ${formatMinor(d.offer_minor, d.currency)}` : ""}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <Input aria-label="Amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="max-w-32" />
          <Input aria-label="Reason for the decision" placeholder="Reason for the decision (required)" value={note} onChange={(e) => setNote(e.target.value)} className="min-w-64 flex-1" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={!note.trim()} onClick={() => void decide("capture")}>Capture from deposit</Button>
          <Button type="button" size="sm" variant="outline" disabled={!note.trim()} onClick={() => void decide("refund")}>Refund the renter</Button>
          <Button type="button" size="sm" variant="outline" disabled={!note.trim()} onClick={() => void decide("dismiss")}>Dismiss</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminTrustPage() {
  const [refresh, setRefresh] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const result = useApiData<Data>(`/api/admin/trust?_r=${refresh}`);
  const data = result.status === "success" ? result.data : null;
  const changed = () => setRefresh((n) => n + 1);

  async function run(body: Record<string, unknown>) {
    const error = await act(body);
    setMessage(error);
    if (!error) changed();
    return error;
  }

  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">Trust and safety</h1>
        <p className="text-sm text-muted-foreground">
          Disputes waiting for a decision, reports, and bookings held for review. Money moves only through the deposit and refund functions, and every decision needs a reason.
        </p>
      </div>
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      {result.status === "loading" && <p className="text-sm text-muted-foreground">Loading...</p>}
      {result.status === "error" && <p className="text-sm text-destructive">{result.error}</p>}

      <h2 className="font-heading text-lg font-semibold text-foreground">Disputes for a reviewer</h2>
      {data?.disputes.length === 0 && <p className="text-sm text-muted-foreground">None.</p>}
      {data?.disputes.map((d) => <DisputeRow key={d.id} d={d} onDone={changed} setMessage={setMessage} />)}

      <h2 className="font-heading text-lg font-semibold text-foreground">Open reports</h2>
      {data?.reports.length === 0 && <p className="text-sm text-muted-foreground">None.</p>}
      {data?.reports.map((r) => (
        <Card key={r.id} className="shadow-card ring-0">
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm text-foreground">{r.kind} {r.target_id} · {formatDate(r.created_at)}</p>
            <p className="text-sm text-muted-foreground">{r.reason}</p>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={() => void run({ action: "handle_report", report_id: r.id, outcome: "actioned" })}>Mark actioned</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void run({ action: "handle_report", report_id: r.id, outcome: "dismissed" })}>Dismiss</Button>
              {r.kind === "review" && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    const error = await run({ action: "remove_review", review_id: r.target_id, reason: r.reason });
                    if (!error) await run({ action: "handle_report", report_id: r.id, outcome: "actioned" });
                  }}
                >
                  Remove the review
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <h2 className="font-heading text-lg font-semibold text-foreground">Bookings held for review</h2>
      {data?.held.length === 0 && <p className="text-sm text-muted-foreground">None.</p>}
      {data?.held.map((b) => (
        <Card key={b.id} className="shadow-card ring-0">
          <CardContent className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-foreground">
              {b.reference} · {b.total_amount} {b.currency ?? ""} · pickup {formatDate(b.pickup_at)} · {b.risk_flags.join(", ")}
            </p>
            <Button type="button" size="sm" onClick={() => void run({ action: "clear_booking", booking_id: b.id })}>Clear for pickup</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
