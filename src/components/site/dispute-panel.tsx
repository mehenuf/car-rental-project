"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLocale, useT } from "@/lib/i18n/provider";
import { formatMinor } from "@/lib/pricing/money";
import { numberingLocale } from "@/lib/i18n/locales";
import { canRespond, typesFor, type DisputeStatus } from "@/lib/disputes/rules";

interface Dispute {
  id: string;
  type: string;
  status: DisputeStatus;
  currency: string;
  offer_minor: number | null;
  offer_by_side: "customer" | "provider" | null;
  offer_count: number;
  deadline_at: string;
}
interface EventRow {
  id: number;
  actor_side: "customer" | "provider" | "platform";
  kind: string;
  body: string | null;
  amount_minor: number | null;
  created_at: string;
}

/** The renter's dispute screen: open a problem report, read the timeline, reply, accept, counter or ask for a reviewer. */
export function DisputePanel({ bookingId, currency, canOpen }: { bookingId: string; currency: string; canOpen: boolean }) {
  const t = useT();
  const locale = useLocale();
  const [data, setData] = useState<{ dispute: Dispute; events: EventRow[] } | null | undefined>(undefined);
  const [text, setText] = useState("");
  const [type, setType] = useState(typesFor("customer")[0]!);
  const [amount, setAmount] = useState("");
  const [counter, setCounter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/account/disputes?booking=${bookingId}`);
    const json = await res.json().catch(() => null);
    setData(res.ok ? (json?.data ?? null) : null);
  }, [bookingId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await fetch(`/api/account/disputes?booking=${bookingId}`);
      const json = await res.json().catch(() => null);
      if (active) setData(res.ok ? (json?.data ?? null) : null);
    })();
    return () => {
      active = false;
    };
  }, [bookingId]);

  const money = (minor: number) => formatMinor(minor, currency, numberingLocale(locale));

  async function call(url: string, method: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? t("disputes.error"));
      setText("");
      setAmount("");
      setCounter("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("disputes.error"));
    } finally {
      setBusy(false);
    }
  }

  if (data === undefined) return null;

  if (data === null) {
    if (!canOpen) return null;
    const open = (e: FormEvent) => {
      e.preventDefault();
      void call("/api/account/disputes", "POST", {
        booking_id: bookingId,
        type,
        body: text,
        claimed_amount_minor: amount ? Math.round(Number(amount) * 100) : undefined,
      });
    };
    return (
      <form onSubmit={open} className="flex flex-col gap-(--space-xs)">
        <h2 className="font-heading text-base font-semibold text-foreground">{t("disputes.title")}</h2>
        <p className="text-xs text-muted-foreground">{t("disputes.intro")}</p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dp-type">{t("disputes.type")}</Label>
          <select id="dp-type" value={type} onChange={(e) => setType(e.target.value as typeof type)} className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm">
            {typesFor("customer").map((k) => <option key={k} value={k}>{t(`disputes.types.${k}`)}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dp-body">{t("disputes.describe")}</Label>
          <Textarea id="dp-body" rows={3} value={text} onChange={(e) => setText(e.target.value)} required maxLength={2000} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dp-amount">{t("disputes.amountAsked")}</Label>
          <Input id="dp-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="max-w-40" />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-fit" disabled={busy || !text.trim()}>{t("disputes.open")}</Button>
      </form>
    );
  }

  const { dispute, events } = data;
  const closed = ["resolved", "dismissed", "agreed"].includes(dispute.status);
  const can = (action: "message" | "accept" | "counter" | "contest") =>
    canRespond({ status: dispute.status, side: "customer", action, offerBySide: dispute.offer_by_side, offerCount: dispute.offer_count });
  const respond = (action: string, extra: Record<string, unknown> = {}) => call(`/api/account/disputes/${dispute.id}`, "POST", { action, ...extra });

  return (
    <div className="flex flex-col gap-(--space-xs)">
      <h2 className="font-heading text-base font-semibold text-foreground">{t("disputes.title")}</h2>
      <p className="text-sm text-muted-foreground">
        {t(`disputes.types.${dispute.type}`)} · <span className="font-medium text-foreground">{t(`disputes.status.${dispute.status}`)}</span>
      </p>
      {!closed && <p className="text-xs text-muted-foreground">{t("disputes.deadline", { date: new Date(dispute.deadline_at).toLocaleString(locale === "en" ? "en-GB" : locale, { dateStyle: "medium", timeStyle: "short" }) })}</p>}

      <ol className="flex flex-col gap-2">
        {events.map((ev) => (
          <li key={ev.id} className="rounded-lg bg-muted px-3 py-2 text-sm">
            <span className="text-xs text-muted-foreground">{t(`disputes.side.${ev.actor_side}`)} · {t(`disputes.kind.${ev.kind}`)}{ev.amount_minor !== null ? ` · ${money(ev.amount_minor)}` : ""}</span>
            {ev.body && <p className="whitespace-pre-wrap break-words text-foreground">{ev.body}</p>}
          </li>
        ))}
      </ol>

      {!closed && (
        <div className="flex flex-col gap-2">
          {dispute.offer_minor !== null && dispute.offer_by_side !== "customer" && (
            <p className="text-sm text-foreground">{t("disputes.offerFromProvider", { amount: money(dispute.offer_minor) })}</p>
          )}
          <Textarea aria-label={t("disputes.message")} rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("disputes.message")} maxLength={2000} />
          <div className="flex flex-wrap items-center gap-2">
            {can("message") && <Button type="button" size="sm" variant="outline" disabled={busy || !text.trim()} onClick={() => void respond("message", { body: text })}>{t("disputes.send")}</Button>}
            {can("accept") && dispute.offer_minor !== null && <Button type="button" size="sm" disabled={busy} onClick={() => void respond("accept")}>{t("disputes.accept")}</Button>}
            {can("contest") && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void respond("contest", { body: text || t("disputes.contestNote") })}>{t("disputes.contest")}</Button>}
          </div>
          {can("counter") && dispute.offer_minor !== null && dispute.offer_by_side !== "customer" && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="dp-counter">{t("disputes.yourOffer")}</Label>
                <Input id="dp-counter" type="number" min="0" step="0.01" value={counter} onChange={(e) => setCounter(e.target.value)} className="max-w-32" />
              </div>
              <Button type="button" size="sm" variant="outline" disabled={busy || counter === ""} onClick={() => void respond("counter", { amount_minor: Math.round(Number(counter) * 100), body: text || undefined })}>{t("disputes.counter")}</Button>
            </div>
          )}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
