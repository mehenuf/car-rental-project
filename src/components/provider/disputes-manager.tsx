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
import { numberingLocale } from "@/lib/i18n/locales";
import { useLocale, useT } from "@/lib/i18n/provider";
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

const SIDE_KEY: Record<string, string> = { customer: "sideCustomer", provider: "sideProvider", platform: "sidePlatform" };
// The fractions read the same in every language; only "empty" and "full" are words.
const FUEL_FRACTION: Record<string, string> = { quarter: "1/4", half: "1/2", three_quarters: "3/4" };

function Thread({ row, onChanged }: { row: Row; onChanged: () => void }) {
  const t = useT();
  const locale = useLocale();
  const detail = useApiData<{ data: Detail | null }>(`/api/provider/disputes?booking=${row.booking_id}&_s=${row.status}&_o=${row.offer_minor}`);
  const [text, setText] = useState("");
  const [counter, setCounter] = useState("");
  const save = useSave();
  const d = detail.status === "success" ? detail.data.data : null;
  const money = (m: number) => formatMinor(m, row.currency, numberingLocale(locale));
  if (!d) return <p role={detail.status === "error" ? "alert" : "status"} className={detail.status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{detail.status === "error" ? detail.error : t("portal.common.loading")}</p>;

  const can = (action: "message" | "accept" | "counter" | "contest") =>
    canRespond({ status: d.dispute.status, side: "provider", action, offerBySide: d.dispute.offer_by_side, offerCount: d.dispute.offer_count });
  const respond = (action: string, extra: Record<string, unknown> = {}) =>
    save.run(async () => { await send(`/api/provider/disputes/${row.id}`, "POST", { action, ...extra }); setText(""); setCounter(""); onChanged(); }, t("portal.disputes.sent"));
  const closed = ["resolved", "dismissed", "agreed"].includes(d.dispute.status);
  const fuel = (level: string) => (level === "empty" ? t("portal.bookings.fuelEmpty") : level === "full" ? t("portal.bookings.fuelFull") : (FUEL_FRACTION[level] ?? level));
  const inspection = (i: Detail["inspections"][number]) =>
    t("portal.disputes.inspLine", { kind: i.kind === "pickup" ? t("portal.disputes.inspPickup") : t("portal.disputes.inspReturn"), km: i.odometer_km, fuel: fuel(i.fuel_level) }) +
    (i.photo_paths.length ? `, ${t("portal.disputes.inspPhotos", { count: i.photo_paths.length })}` : "");

  return (
    <div className="flex flex-col gap-2">
      {d.inspections.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("portal.disputes.inspections", { list: d.inspections.map(inspection).join(" · ") })}
        </p>
      )}
      <ol className="flex flex-col gap-1.5">
        {d.events.map((e) => (
          <li key={e.id} className="rounded-lg bg-muted px-3 py-2 text-sm">
            <span className="text-xs text-muted-foreground">{SIDE_KEY[e.actor_side] ? t(`portal.disputes.${SIDE_KEY[e.actor_side]}`) : e.actor_side} · {t(`disputes.kind.${e.kind}`)}{e.amount_minor !== null ? ` · ${money(e.amount_minor)}` : ""} · {formatDate(e.created_at, locale)}</span>
            {e.body && <p className="whitespace-pre-wrap text-foreground">{e.body}</p>}
          </li>
        ))}
      </ol>
      {!closed && (
        <>
          {d.dispute.offer_minor !== null && d.dispute.offer_by_side !== "provider" && <p className="text-sm">{t("portal.disputes.renterOffers", { amount: money(d.dispute.offer_minor) })}</p>}
          <Textarea aria-label={t("disputes.message")} rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("disputes.message")} maxLength={2000} />
          <div className="flex flex-wrap items-center gap-2">
            {can("message") && <Button type="button" size="sm" variant="outline" disabled={save.busy || !text.trim()} onClick={() => void respond("message", { body: text })}>{t("disputes.send")}</Button>}
            {can("accept") && d.dispute.offer_minor !== null && <Button type="button" size="sm" disabled={save.busy} onClick={() => void respond("accept")}>{t("disputes.accept")}</Button>}
            {can("contest") && <Button type="button" size="sm" variant="outline" disabled={save.busy} onClick={() => void respond("contest", { body: text || t("disputes.contestNote") })}>{t("disputes.contest")}</Button>}
          </div>
          {can("counter") && d.dispute.offer_by_side !== "provider" && (
            <div className="flex items-end gap-2">
              <Input aria-label={t("disputes.yourOffer")} type="number" min="0" step="0.01" value={counter} onChange={(e) => setCounter(e.target.value)} className="max-w-32" placeholder={t("disputes.yourOffer")} />
              <Button type="button" size="sm" variant="outline" disabled={save.busy || counter === ""} onClick={() => void respond("counter", { amount_minor: Math.round(Number(counter) * 100), body: text || undefined })}>{t("disputes.counter")}</Button>
            </div>
          )}
        </>
      )}
      <Status message={save.message} ok={save.ok} />
    </div>
  );
}

function OpenDispute({ onDone }: { onDone: () => void }) {
  const t = useT();
  const [bookingId, setBookingId] = useState("");
  const [type, setType] = useState("damage");
  const [amount, setAmount] = useState("");
  const [body, setBody] = useState("");
  const save = useSave();
  return (
    <Card className="shadow-card ring-0">
      <CardContent className="flex flex-col gap-2">
        <h2 className="font-heading text-base font-semibold text-foreground">{t("portal.disputes.openTitle")}</h2>
        <p className="text-xs text-muted-foreground">{t("portal.disputes.openHelp")}</p>
        <Input aria-label={t("portal.disputes.bookingId")} placeholder={t("portal.disputes.bookingId")} value={bookingId} onChange={(e) => setBookingId(e.target.value.trim())} />
        <select aria-label={t("portal.disputes.type")} value={type} onChange={(e) => setType(e.target.value)} className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm">
          <option value="damage">{t("disputes.types.damage")}</option>
          <option value="cleanliness_or_fees">{t("disputes.types.cleanliness_or_fees")}</option>
        </select>
        <Input aria-label={t("portal.disputes.amountClaimed")} type="number" min="0" step="0.01" placeholder={t("portal.disputes.amountClaimed")} value={amount} onChange={(e) => setAmount(e.target.value)} className="max-w-40" />
        <Textarea aria-label={t("portal.disputes.whatHappened")} rows={3} placeholder={t("portal.disputes.whatHappened")} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />
        <Status message={save.message} ok={save.ok} />
        <Button type="button" size="sm" className="w-fit" disabled={save.busy || !bookingId || !amount || !body.trim()}
          onClick={() => void save.run(async () => { await send("/api/provider/disputes", "POST", { booking_id: bookingId, type, body, claimed_amount_minor: Math.round(Number(amount) * 100) }); onDone(); }, t("portal.disputes.opened"))}>
          {t("portal.disputes.openBtn")}
        </Button>
      </CardContent>
    </Card>
  );
}

export function DisputesManager() {
  const t = useT();
  const locale = useLocale();
  const [refresh, setRefresh] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const result = useApiData<{ data: Row[] }>(`/api/provider/disputes?_r=${refresh}`);
  const rows = result.status === "success" ? result.data.data : [];
  const changed = () => setRefresh((n) => n + 1);

  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">{t("portal.nav.disputes")}</h1>
        <p className="text-sm text-muted-foreground">{t("portal.disputes.intro")}</p>
      </div>
      <OpenDispute onDone={changed} />
      {result.status === "error" && <p className="text-sm text-destructive">{result.error}</p>}
      {result.status === "success" && rows.length === 0 && <p className="text-sm text-muted-foreground">{t("portal.disputes.none")}</p>}
      {rows.map((r) => (
        <Card key={r.id} className="shadow-card ring-0">
          <CardContent className="flex flex-col gap-2">
            <button type="button" className="flex flex-wrap items-center justify-between gap-2 text-start" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
              <span className="font-medium text-foreground">{r.reference} · {t(`disputes.types.${r.type}`)}</span>
              <span className="text-sm text-muted-foreground">{t(`disputes.status.${r.status}`)}{r.claimed_amount_minor !== null ? ` · ${t("portal.disputes.claimed", { amount: formatMinor(r.claimed_amount_minor, r.currency, numberingLocale(locale)) })}` : ""}</span>
            </button>
            {open === r.id && <Thread row={r} onChanged={changed} />}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
