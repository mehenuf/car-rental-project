"use client";

import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { Status, send, useSave } from "@/components/provider/form-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiData } from "@/hooks/use-api-data";
import { numberingLocale } from "@/lib/i18n/locales";
import { useLocale, useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

function useMoney2() {
  const locale = useLocale();
  return (v: number) => new Intl.NumberFormat(numberingLocale(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

const selectClass = "h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm";

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------
// Prices and seasons
// ---------------------------------------------------------------

interface Plan {
  id: string;
  vehicle_id: string;
  vehicle_name: string;
  branch_id: number;
  branch_name: string;
  currency: string;
  base_daily: number;
  weekend_uplift_pct: number;
  weekly_discount_pct: number;
  monthly_discount_pct: number;
  min_days: number;
  max_days: number | null;
  seasons: { id: string; start_date: string; end_date: string; daily: number }[];
}

function PlanCard({ plan, onChanged }: { plan: Plan; onChanged: () => void }) {
  const t = useT();
  const money = useMoney2();
  const [f, setF] = useState({
    base: String(plan.base_daily),
    weekend: String(plan.weekend_uplift_pct),
    weekly: String(plan.weekly_discount_pct),
    monthly: String(plan.monthly_discount_pct),
    min: String(plan.min_days),
    max: plan.max_days === null ? "" : String(plan.max_days),
  });
  const [s, setS] = useState({ start: "", end: "", daily: "" });
  const save = useSave();
  const seasonSave = useSave();

  function submit(e: FormEvent) {
    e.preventDefault();
    void save.run(async () => {
      await send("/api/provider/rate-plans", "PUT", {
        vehicle_id: plan.vehicle_id,
        branch_id: plan.branch_id,
        base_daily: Number(f.base),
        weekend_uplift_pct: Number(f.weekend),
        weekly_discount_pct: Number(f.weekly),
        monthly_discount_pct: Number(f.monthly),
        min_days: Number(f.min),
        max_days: f.max.trim() ? Number(f.max) : null,
      });
      onChanged();
    });
  }

  function addSeason(e: FormEvent) {
    e.preventDefault();
    void seasonSave.run(async () => {
      await send(`/api/provider/rate-plans/${plan.id}/seasons`, "POST", { start_date: s.start, end_date: s.end, daily: Number(s.daily) });
      setS({ start: "", end: "", daily: "" });
      onChanged();
    }, t("portal.pricing.seasonAdded"));
  }

  const id = (name: string) => `${name}-${plan.id}`;
  return (
    <div className="flex flex-col gap-(--space-sm) rounded-xl border border-border p-(--space-sm)">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium text-foreground">{plan.vehicle_name}</h3>
        <span className="text-sm text-muted-foreground">{plan.branch_name} · {plan.currency}</span>
      </div>
      <form onSubmit={submit} className="grid gap-(--space-sm) sm:grid-cols-3 lg:grid-cols-6">
        <Field id={id("base")} label={t("portal.fleet.dailyPrice")}><Input id={id("base")} type="number" min="0" step="0.01" value={f.base} onChange={(e) => setF({ ...f, base: e.target.value })} required /></Field>
        <Field id={id("wk")} label={t("portal.pricing.weekend")}><Input id={id("wk")} type="number" min="0" max="100" step="0.5" value={f.weekend} onChange={(e) => setF({ ...f, weekend: e.target.value })} /></Field>
        <Field id={id("w7")} label={t("portal.pricing.weekly")}><Input id={id("w7")} type="number" min="0" max="90" step="0.5" value={f.weekly} onChange={(e) => setF({ ...f, weekly: e.target.value })} /></Field>
        <Field id={id("w28")} label={t("portal.pricing.monthly")}><Input id={id("w28")} type="number" min="0" max="90" step="0.5" value={f.monthly} onChange={(e) => setF({ ...f, monthly: e.target.value })} /></Field>
        <Field id={id("min")} label={t("portal.pricing.minDays")}><Input id={id("min")} type="number" min="1" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} /></Field>
        <Field id={id("max")} label={t("portal.pricing.maxDays")}><Input id={id("max")} type="number" min="1" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} placeholder={t("portal.pricing.none")} /></Field>
        <div className="flex items-center gap-3 sm:col-span-3 lg:col-span-6">
          <Button type="submit" disabled={save.busy}>{t("portal.pricing.savePrice")}</Button>
          <Status message={save.message} ok={save.ok} />
        </div>
      </form>

      <div className="flex flex-col gap-2 border-t border-border pt-(--space-sm)">
        <h4 className="text-sm font-medium text-foreground">{t("portal.pricing.seasonal")}</h4>
        {plan.seasons.length === 0 && <p className="text-sm text-muted-foreground">{t("portal.pricing.noSeasons")}</p>}
        <ul className="flex flex-col divide-y divide-border text-sm">
          {plan.seasons.map((season) => (
            <li key={season.id} className="flex items-center justify-between py-1.5">
              <span>{t("portal.pricing.seasonLine", { from: season.start_date, to: season.end_date, price: money(season.daily) })}</span>
              <Button type="button" size="icon" variant="ghost" aria-label={t("portal.pricing.removeSeason")} onClick={() => void send(`/api/provider/seasons/${season.id}`, "DELETE").then(onChanged)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        <form onSubmit={addSeason} className="grid items-end gap-(--space-sm) sm:grid-cols-4">
          <Field id={id("ss")} label={t("portal.calendar.from")}><Input id={id("ss")} type="date" value={s.start} onChange={(e) => setS({ ...s, start: e.target.value })} required /></Field>
          <Field id={id("se")} label={t("portal.calendar.toIncluded")}><Input id={id("se")} type="date" value={s.end} onChange={(e) => setS({ ...s, end: e.target.value })} required /></Field>
          <Field id={id("sd")} label={t("portal.fleet.dailyPrice")}><Input id={id("sd")} type="number" min="0" step="0.01" value={s.daily} onChange={(e) => setS({ ...s, daily: e.target.value })} required /></Field>
          <Button type="submit" variant="outline" disabled={seasonSave.busy}>{t("portal.pricing.addSeason")}</Button>
        </form>
        <Status message={seasonSave.message} ok={seasonSave.ok} />
      </div>
    </div>
  );
}

function PricesTab() {
  const t = useT();
  const [refresh, setRefresh] = useState(0);
  const plans = useApiData<{ data: Plan[] }>(`/api/provider/rate-plans?_r=${refresh}`);
  if (plans.status === "loading") return <p className="text-sm text-muted-foreground">{t("portal.common.loading")}</p>;
  if (plans.status === "error") return <p className="text-sm text-destructive">{plans.error}</p>;
  if (plans.data.data.length === 0) return <p className="text-sm text-muted-foreground">{t("portal.pricing.addCarFirst")}</p>;
  return (
    <div className="flex flex-col gap-(--space-sm)">
      {plans.data.data.map((p) => (
        <PlanCard key={`${p.id}-${refresh}`} plan={p} onChanged={() => setRefresh((n) => n + 1)} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------
// Extras
// ---------------------------------------------------------------

interface Extra {
  id: string;
  code: string;
  name: string;
  kind: "extra" | "insurance";
  pricing: "per_day" | "per_rental";
  currency: string;
  unit_price: number;
  max_quantity: number;
  cap: number | null;
  is_mandatory: boolean;
  is_active: boolean;
}

function ExtrasTab() {
  const t = useT();
  const money = useMoney2();
  const [refresh, setRefresh] = useState(0);
  const extras = useApiData<{ data: Extra[] }>(`/api/provider/extras?_r=${refresh}`);
  const [f, setF] = useState({ code: "", name: "", kind: "extra", pricing: "per_day", price: "", max: "1", mandatory: false });
  const save = useSave();
  const changed = () => setRefresh((n) => n + 1);

  function add(e: FormEvent) {
    e.preventDefault();
    void save.run(async () => {
      await send("/api/provider/extras", "POST", { code: f.code, name: f.name, kind: f.kind, pricing: f.pricing, unit_price: Number(f.price), max_quantity: Number(f.max), is_mandatory: f.mandatory });
      setF({ code: "", name: "", kind: "extra", pricing: "per_day", price: "", max: "1", mandatory: false });
      changed();
    }, t("portal.pricing.extraAdded"));
  }

  return (
    <div className="flex flex-col gap-(--space-sm)">
      {extras.status === "success" && extras.data.data.length === 0 && <p className="text-sm text-muted-foreground">{t("portal.pricing.noExtras")}</p>}
      <ul className="flex flex-col divide-y divide-border text-sm">
        {extras.status === "success" && extras.data.data.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              <span className="font-medium text-foreground">{x.name}</span> <span className="text-muted-foreground">{t("portal.pricing.extraDetail", { code: x.code, price: money(x.unit_price), currency: x.currency, charge: t(x.pricing === "per_day" ? "portal.pricing.perDay" : "portal.pricing.perRental"), max: x.max_quantity })}</span>
              {x.is_mandatory && <Badge variant="outline" className="ms-2">{t("portal.pricing.included")}</Badge>}
              {!x.is_active && <Badge variant="outline" className="ms-2">{t("portal.pricing.off")}</Badge>}
            </span>
            <span className="flex gap-1.5">
              <Button type="button" size="sm" variant="outline" onClick={() => void send(`/api/provider/extras/${x.id}`, "PATCH", { is_active: !x.is_active }).then(changed)}>{x.is_active ? t("portal.pricing.switchOff") : t("portal.pricing.switchOn")}</Button>
              <Button type="button" size="icon" variant="ghost" aria-label={t("portal.pricing.deleteName", { name: x.name })} onClick={() => void send(`/api/provider/extras/${x.id}`, "DELETE").then(changed)}><Trash2 /></Button>
            </span>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="grid items-end gap-(--space-sm) rounded-xl border border-border p-(--space-sm) sm:grid-cols-3 lg:grid-cols-6">
        <Field id="ex-code" label={t("portal.pricing.code")}><Input id="ex-code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required placeholder="child-seat" /></Field>
        <Field id="ex-name" label={t("portal.pricing.name")}><Input id="ex-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
        <Field id="ex-kind" label={t("portal.pricing.type")}>
          <select id="ex-kind" className={selectClass} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="extra">{t("portal.pricing.kindExtra")}</option><option value="insurance">{t("portal.pricing.kindInsurance")}</option></select>
        </Field>
        <Field id="ex-pricing" label={t("portal.pricing.charged")}>
          <select id="ex-pricing" className={selectClass} value={f.pricing} onChange={(e) => setF({ ...f, pricing: e.target.value })}><option value="per_day">{t("portal.pricing.chargedDay")}</option><option value="per_rental">{t("portal.pricing.chargedOnce")}</option></select>
        </Field>
        <Field id="ex-price" label={t("portal.pricing.price")}><Input id="ex-price" type="number" min="0" step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} required /></Field>
        <Field id="ex-max" label={t("portal.pricing.maxQty")}><Input id="ex-max" type="number" min="1" max="20" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={f.mandatory} onChange={(e) => setF({ ...f, mandatory: e.target.checked })} /> {t("portal.pricing.mandatory")}</label>
        <div className="flex items-center gap-3 sm:col-span-3 lg:col-span-4"><Button type="submit" disabled={save.busy}>{t("portal.pricing.addExtra")}</Button><Status message={save.message} ok={save.ok} /></div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------
// Cancellation, deposit and driver rules
// ---------------------------------------------------------------

interface PolicyForm {
  deposit_type: "fixed" | "percent";
  deposit_value: number;
  cancellation_tiers: { hours_before: number; refund_pct: number }[];
  min_driver_age: number;
  young_driver_age: number | null;
  young_driver_fee: number;
}

function PolicyEditor({ initial, currency }: { initial: PolicyForm; currency: string }) {
  const t = useT();
  const [f, setF] = useState(initial);
  const save = useSave();

  function setTier(i: number, patch: Partial<{ hours_before: number; refund_pct: number }>) {
    setF({ ...f, cancellation_tiers: f.cancellation_tiers.map((tier, j) => (j === i ? { ...tier, ...patch } : tier)) });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void save.run(() => send("/api/provider/policy", "PUT", f));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-(--space-md)">
      <div className="grid gap-(--space-sm) sm:grid-cols-3">
        <Field id="po-dt" label={t("portal.pricing.deposit")}>
          <select id="po-dt" className={selectClass} value={f.deposit_type} onChange={(e) => setF({ ...f, deposit_type: e.target.value as "fixed" | "percent" })}><option value="fixed">{t("portal.pricing.depositFixed", { currency })}</option><option value="percent">{t("portal.pricing.depositPercent")}</option></select>
        </Field>
        <Field id="po-dv" label={f.deposit_type === "fixed" ? t("portal.pricing.amount", { currency }) : t("portal.pricing.percent")}><Input id="po-dv" type="number" min="0" step="0.01" value={f.deposit_value} onChange={(e) => setF({ ...f, deposit_value: Number(e.target.value) })} /></Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-foreground">{t("portal.pricing.cancelRefunds")}</legend>
        <p className="text-xs text-muted-foreground">{t("portal.pricing.cancelHelp")}</p>
        {f.cancellation_tiers.map((tier, i) => (
          <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Field id={`po-h${i}`} label={t("portal.pricing.hoursBefore")}><Input id={`po-h${i}`} type="number" min="0" max="720" value={tier.hours_before} onChange={(e) => setTier(i, { hours_before: Number(e.target.value) })} /></Field>
            <Field id={`po-r${i}`} label={t("portal.pricing.refundPct")}><Input id={`po-r${i}`} type="number" min="0" max="100" value={tier.refund_pct} onChange={(e) => setTier(i, { refund_pct: Number(e.target.value) })} /></Field>
            <Button type="button" size="icon" variant="ghost" aria-label={t("portal.pricing.removeRow")} onClick={() => setF({ ...f, cancellation_tiers: f.cancellation_tiers.filter((_, j) => j !== i) })}><Trash2 /></Button>
          </div>
        ))}
        {f.cancellation_tiers.length < 6 && (
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setF({ ...f, cancellation_tiers: [...f.cancellation_tiers, { hours_before: 0, refund_pct: 0 }] })}>{t("portal.pricing.addRow")}</Button>
        )}
      </fieldset>

      <div className="grid gap-(--space-sm) sm:grid-cols-3">
        <Field id="po-age" label={t("portal.pricing.minAge")}><Input id="po-age" type="number" min="16" max="30" value={f.min_driver_age} onChange={(e) => setF({ ...f, min_driver_age: Number(e.target.value) })} /></Field>
        <Field id="po-yage" label={t("portal.pricing.youngUnder")}><Input id="po-yage" type="number" min="18" max="30" value={f.young_driver_age ?? ""} onChange={(e) => setF({ ...f, young_driver_age: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
        <Field id="po-yfee" label={t("portal.pricing.youngFee", { currency })}><Input id="po-yfee" type="number" min="0" step="0.01" value={f.young_driver_fee} onChange={(e) => setF({ ...f, young_driver_fee: Number(e.target.value) })} /></Field>
      </div>

      <div className="flex items-center gap-3"><Button type="submit" disabled={save.busy}>{t("portal.pricing.savePolicy")}</Button><Status message={save.message} ok={save.ok} /></div>
    </form>
  );
}

function PolicyTab() {
  const t = useT();
  const policy = useApiData<{ data: PolicyForm; currency: string }>("/api/provider/policy");
  if (policy.status === "loading") return <p className="text-sm text-muted-foreground">{t("portal.common.loading")}</p>;
  if (policy.status === "error") return <p className="text-sm text-destructive">{policy.error}</p>;
  return <PolicyEditor initial={policy.data.data} currency={policy.data.currency} />;
}

// ---------------------------------------------------------------
// Promo codes
// ---------------------------------------------------------------

interface Promo {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  value: number;
  min_days: number;
  is_active: boolean;
}

function PromosTab() {
  const t = useT();
  const money = useMoney2();
  const [refresh, setRefresh] = useState(0);
  const promos = useApiData<{ data: Promo[] }>(`/api/provider/promos?_r=${refresh}`);
  const [f, setF] = useState({ code: "", type: "percent", value: "", minDays: "1", from: "", to: "" });
  const save = useSave();
  const changed = () => setRefresh((n) => n + 1);

  function add(e: FormEvent) {
    e.preventDefault();
    void save.run(async () => {
      await send("/api/provider/promos", "POST", { code: f.code, discount_type: f.type, value: Number(f.value), min_days: Number(f.minDays), valid_from: f.from || null, valid_to: f.to || null });
      setF({ code: "", type: "percent", value: "", minDays: "1", from: "", to: "" });
      changed();
    }, t("portal.pricing.codeCreated"));
  }

  return (
    <div className="flex flex-col gap-(--space-sm)">
      {promos.status === "success" && promos.data.data.length === 0 && <p className="text-sm text-muted-foreground">{t("portal.pricing.noPromos")}</p>}
      <ul className="flex flex-col divide-y divide-border text-sm">
        {promos.status === "success" && promos.data.data.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span><span className="font-mono font-medium text-foreground">{p.code}</span> <span className="text-muted-foreground">{t("portal.pricing.promoDetail", { discount: p.discount_type === "percent" ? t("portal.pricing.percentOff", { value: p.value }) : t("portal.pricing.fixedOff", { value: money(p.value) }), days: p.min_days })}</span>{!p.is_active && <Badge variant="outline" className="ms-2">{t("portal.pricing.off")}</Badge>}</span>
            <span className="flex gap-1.5">
              <Button type="button" size="sm" variant="outline" onClick={() => void send(`/api/provider/promos/${p.id}`, "PATCH", { is_active: !p.is_active }).then(changed)}>{p.is_active ? t("portal.pricing.switchOff") : t("portal.pricing.switchOn")}</Button>
              <Button type="button" size="icon" variant="ghost" aria-label={t("portal.pricing.deleteName", { name: p.code })} onClick={() => void send(`/api/provider/promos/${p.id}`, "DELETE").then(changed)}><Trash2 /></Button>
            </span>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="grid items-end gap-(--space-sm) rounded-xl border border-border p-(--space-sm) sm:grid-cols-3 lg:grid-cols-6">
        <Field id="pr-code" label={t("portal.pricing.code")}><Input id="pr-code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required placeholder="SUMMER25" /></Field>
        <Field id="pr-type" label={t("portal.pricing.discount")}><select id="pr-type" className={selectClass} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="percent">{t("portal.pricing.optPercent")}</option><option value="fixed">{t("portal.pricing.optFixed")}</option></select></Field>
        <Field id="pr-val" label={t("portal.pricing.value")}><Input id="pr-val" type="number" min="0" step="0.01" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} required /></Field>
        <Field id="pr-min" label={t("portal.pricing.minDays")}><Input id="pr-min" type="number" min="1" value={f.minDays} onChange={(e) => setF({ ...f, minDays: e.target.value })} /></Field>
        <Field id="pr-from" label={t("portal.pricing.validFrom")}><Input id="pr-from" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field id="pr-to" label={t("portal.pricing.validTo")}><Input id="pr-to" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <div className="flex items-center gap-3 sm:col-span-3 lg:col-span-6"><Button type="submit" disabled={save.busy}>{t("portal.pricing.createCode")}</Button><Status message={save.message} ok={save.ok} /></div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------
// One-way fees
// ---------------------------------------------------------------

function OneWayTab() {
  const t = useT();
  const money = useMoney2();
  const [refresh, setRefresh] = useState(0);
  const branches = useApiData<{ data: { id: number; name: string; city: string }[] }>("/api/provider/branches");
  const fees = useApiData<{ data: { from_branch_id: number; to_branch_id: number; amount: number }[] }>(`/api/provider/one-way-fees?_r=${refresh}`);
  const [f, setF] = useState({ from: "", to: "", amount: "" });
  const save = useSave();

  const list = branches.status === "success" ? branches.data.data : [];
  const name = (id: number) => list.find((b) => b.id === id)?.name ?? String(id);
  if (branches.status === "success" && list.length < 2) return <p className="text-sm text-muted-foreground">{t("portal.pricing.needTwo")}</p>;

  function set(e: FormEvent) {
    e.preventDefault();
    void save.run(async () => {
      await send("/api/provider/one-way-fees", "PUT", { from_branch_id: Number(f.from || list[0]?.id), to_branch_id: Number(f.to || list[1]?.id), amount: Number(f.amount) });
      setF({ from: "", to: "", amount: "" });
      setRefresh((n) => n + 1);
    });
  }

  return (
    <div className="flex flex-col gap-(--space-sm)">
      <ul className="flex flex-col divide-y divide-border text-sm">
        {fees.status === "success" && fees.data.data.map((x) => (
          <li key={`${x.from_branch_id}-${x.to_branch_id}`} className="flex items-center justify-between py-2">
            <span>{t("portal.pricing.feeLine", { from: name(x.from_branch_id), to: name(x.to_branch_id), amount: money(x.amount) })}</span>
            <Button type="button" size="icon" variant="ghost" aria-label={t("portal.pricing.removeFee")} onClick={() => void send(`/api/provider/one-way-fees?from=${x.from_branch_id}&to=${x.to_branch_id}`, "DELETE").then(() => setRefresh((n) => n + 1))}><Trash2 /></Button>
          </li>
        ))}
      </ul>
      <form onSubmit={set} className="grid items-end gap-(--space-sm) rounded-xl border border-border p-(--space-sm) sm:grid-cols-4">
        <Field id="ow-from" label={t("portal.pricing.from")}><select id="ow-from" className={selectClass} value={f.from || String(list[0]?.id ?? "")} onChange={(e) => setF({ ...f, from: e.target.value })}>{list.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        <Field id="ow-to" label={t("portal.pricing.to")}><select id="ow-to" className={selectClass} value={f.to || String(list[1]?.id ?? "")} onChange={(e) => setF({ ...f, to: e.target.value })}>{list.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        <Field id="ow-amt" label={t("portal.pricing.fee")}><Input id="ow-amt" type="number" min="0" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></Field>
        <div className="flex items-center gap-3"><Button type="submit" disabled={save.busy}>{t("portal.pricing.setFee")}</Button></div>
      </form>
      <Status message={save.message} ok={save.ok} />
    </div>
  );
}

// ---------------------------------------------------------------

const TABS = [
  { id: "prices", label: "portal.pricing.tabPrices", body: () => <PricesTab /> },
  { id: "extras", label: "portal.pricing.tabExtras", body: () => <ExtrasTab /> },
  { id: "policy", label: "portal.pricing.tabPolicy", body: () => <PolicyTab /> },
  { id: "promos", label: "portal.pricing.tabPromos", body: () => <PromosTab /> },
  { id: "oneway", label: "portal.pricing.tabOneWay", body: () => <OneWayTab /> },
] as const;

export function PricingManager({ individual }: { individual: boolean }) {
  const t = useT();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("prices");
  const tabs = individual ? TABS.filter((x) => x.id !== "oneway") : TABS;
  const current = tabs.find((t) => t.id === tab) ?? tabs[0]!;

  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">{t("portal.nav.pricing")}</h1>
        <p className="text-sm text-muted-foreground">{t("portal.pricing.intro")}</p>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("portal.pricing.tabsAria")}>
        {tabs.map((tb) => (
          <button key={tb.id} type="button" role="tab" aria-selected={current.id === tb.id} onClick={() => setTab(tb.id)}
            className={cn("rounded-full border px-3 py-1 text-sm", current.id === tb.id ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
            {t(tb.label)}
          </button>
        ))}
      </div>
      <Card className="shadow-card ring-0"><CardContent>{current.body()}</CardContent></Card>
    </div>
  );
}
