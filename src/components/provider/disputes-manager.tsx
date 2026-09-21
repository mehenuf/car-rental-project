"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Status, send, useSave } from "@/components/provider/form-utils";
import { useApiData } from "@/hooks/use-api-data";
import { canRespond, type DisputeStatus } from "@/lib/disputes/rules";
import { formatDate } from "@/lib/format";
import { formatMinor } from "@/lib/pricing/money";

interface Row {
  id: string;
  booking_id: string;
  reference: string;
  type: string;
  status: DisputeStatus;
  claimed_amount_minor: number | null;
  offer_minor: number | null;
  offer_by_side: "customer" | "provider" | null;
  currency: string;
  deadline_at: string;
}
interface Detail {
  dispute: Row & { offer_count: number };
  events: { id: number; actor_side: string; kind: string; body: string | null; amount_minor: number | null; created_at: string }[];
  inspections: { kind: string; odometer_km: number; fuel_level: string; notes: string | null; photo_paths: string[] }[];
}

const TYPE_LABEL: Record<string, string> = {
  damage: "Damage", cleanliness_or_fees: "Cleaning or fees", listing_mismatch: "Car not as described", overcharge: "Overcharge", service_problem: "Service problem",
};

function Thread({ row, onChanged }: { row: Row; onChanged: () => void }) {
  const detail = useApiData<{ data: Detail | null }>(`/api/provider/disputes?booking=${row.booking_id}&_s=${row.status}&_o=${row.offer_minor}`);
  const [text, setText] = useState("");
  const [counter, setCounter] = useState("");
  const save = useSave();
  const d = detail.status === "success" ? detail.data.data : null;
  const money = (m: number) => formatMinor(m, row.currency);
  if (!d) return <p role={detail.status === "error" ? "alert" : "status"} className={detail.status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{detail.status === "error" ? detail.error : "Loading..."}</p>;

  const can = (action: "message" | "accept" | "counter" | "contest") =>
    canRespond({ status: d.dispute.status, side: "provider", action, offerBySide: d.dispute.offer_by_side, offerCount: d.dispute.offer_count });
  const respond = (action: string, extra: Record<string, unknown> = {}) =>
    save.run(async () => { await send(`/api/provider/disputes/${row.id}`, "POST", { action, ...extra }); setText(""); setCounter(""); onChanged(); }, "Sent.");
  const closed = ["resolved", "dismissed", "agreed"].includes(d.dispute.status);

  return (
    <div className="flex flex-col gap-2">
      {d.inspections.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Inspections on file: {d.inspections.map((i) => `${i.kind} ${i.odometer_km} km, fuel ${i.fuel_level}${i.photo_paths.length ? `, ${i.photo_paths.length} photos` : ""}`).join(" · ")}
        </p>
      )}
      <ol className="flex flex-col gap-1.5">
        {d.events.map((e) => (
          <li key={e.id} className="rounded-lg bg-muted px-3 py-2 text-sm">
            <span className="text-xs text-muted-foreground">{e.actor_side} · {e.kind}{e.amount_minor !== null ? ` · ${money(e.amount_minor)}` : ""} · {formatDate(e.created_at)}</span>
            {e.body && <p className="whitespace-pre-wrap text-foreground">{e.body}</p>}
          </li>
        ))}
      </ol>
      {!closed && (
        <>
          {d.dispute.offer_minor !== null && d.dispute.offer_by_side !== "provider" && <p className="text-sm">The renter offers {money(d.dispute.offer_minor)}.</p>}
          <Textarea aria-label="Message" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a message" maxLength={2000} />
          <div className="flex flex-wrap items-center gap-2">
            {can("message") && <Button type="button" size="sm" variant="outline" disabled={save.busy || !text.trim()} onClick={() => void respond("message", { body: text })}>Send</Button>}
            {can("accept") && d.dispute.offer_minor !== null && <Button type="button" size="sm" disabled={save.busy} onClick={() => void respond("accept")}>Accept offer</Button>}
            {can("contest") && <Button type="button" size="sm" variant="outline" disabled={save.busy} onClick={() => void respond("contest", { body: text || "Please ask a reviewer to decide." })}>Ask a reviewer to decide</Button>}
          </div>
          {can("counter") && d.dispute.offer_by_side !== "provider" && (
            <div className="flex items-end gap-2">
              <Input aria-label="Your offer" type="number" min="0" step="0.01" value={counter} onChange={(e) => setCounter(e.target.value)} className="max-w-32" placeholder="Your offer" />
              <Button type="button" size="sm" variant="outline" disabled={save.busy || counter === ""} onClick={() => void respond("counter", { amount_minor: Math.round(Number(counter) * 100), body: text || undefined })}>Counter offer</Button>
            </div>
          )}
        </>
      )}
      <Status message={save.message} ok={save.ok} />
    </div>
  );
}

function OpenDispute({ onDone }: { onDone: () => void }) {
  const [bookingId, setBookingId] = useState("");
  const [type, setType] = useState("damage");
  const [amount, setAmount] = useState("");
  const [body, setBody] = useState("");
  const save = useSave();
  return (
    <Card className="shadow-card ring-0">
      <CardContent className="flex flex-col gap-2">
        <h2 className="font-heading text-base font-semibold text-foreground">Open a dispute</h2>
        <p className="text-xs text-muted-foreground">Within 48 hours of a return you can claim damage or cleaning and fees against the security deposit. Paste the booking id from the bookings list. The payout for that booking is paused until it is settled.</p>
        <Input aria-label="Booking id" placeholder="Booking id" value={bookingId} onChange={(e) => setBookingId(e.target.value.trim())} />
        <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)} className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm">
          <option value="damage">Damage</option>
          <option value="cleanliness_or_fees">Cleaning or fees</option>
        </select>
        <Input aria-label="Amount claimed" type="number" min="0" step="0.01" placeholder="Amount claimed" value={amount} onChange={(e) => setAmount(e.target.value)} className="max-w-40" />
        <Textarea aria-label="What happened" rows={3} placeholder="What happened?" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />
        <Status message={save.message} ok={save.ok} />
        <Button type="button" size="sm" className="w-fit" disabled={save.busy || !bookingId || !amount || !body.trim()}
          onClick={() => void save.run(async () => { await send("/api/provider/disputes", "POST", { booking_id: bookingId, type, body, claimed_amount_minor: Math.round(Number(amount) * 100) }); onDone(); }, "Dispute opened.")}>
          Open dispute
        </Button>
      </CardContent>
    </Card>
  );
}

export function DisputesManager() {
  const [refresh, setRefresh] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const result = useApiData<{ data: Row[] }>(`/api/provider/disputes?_r=${refresh}`);
  const rows = result.status === "success" ? result.data.data : [];
  const changed = () => setRefresh((n) => n + 1);

  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">Disputes</h1>
        <p className="text-sm text-muted-foreground">Agree an amount with the renter, or ask a BestCar reviewer to decide. If nobody replies within 72 hours it goes to a reviewer.</p>
      </div>
      <OpenDispute onDone={changed} />
      {result.status === "error" && <p className="text-sm text-destructive">{result.error}</p>}
      {result.status === "success" && rows.length === 0 && <p className="text-sm text-muted-foreground">No disputes.</p>}
      {rows.map((r) => (
        <Card key={r.id} className="shadow-card ring-0">
          <CardContent className="flex flex-col gap-2">
            <button type="button" className="flex flex-wrap items-center justify-between gap-2 text-start" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
              <span className="font-medium text-foreground">{r.reference} · {TYPE_LABEL[r.type] ?? r.type}</span>
              <span className="text-sm text-muted-foreground">{r.status.replace("_", " ")}{r.claimed_amount_minor !== null ? ` · claimed ${formatMinor(r.claimed_amount_minor, r.currency)}` : ""}</span>
            </button>
            {open === r.id && <Thread row={r} onChanged={changed} />}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
