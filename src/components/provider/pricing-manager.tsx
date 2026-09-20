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
import { cn } from "@/lib/utils";

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
    }, "Season added.");
  }

  const id = (name: string) => `${name}-${plan.id}`;
  return (
    <div className="flex flex-col gap-(--space-sm) rounded-xl border border-border p-(--space-sm)">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium text-foreground">{plan.vehicle_name}</h3>
        <span className="text-sm text-muted-foreground">{plan.branch_name} · {plan.currency}</span>
      </div>
      <form onSubmit={submit} className="grid gap-(--space-sm) sm:grid-cols-3 lg:grid-cols-6">
        <Field id={id("base")} label="Daily price"><Input id={id("base")} type="number" min="0" step="0.01" value={f.base} onChange={(e) => setF({ ...f, base: e.target.value })} required /></Field>
        <Field id={id("wk")} label="Weekend uplift %"><Input id={id("wk")} type="number" min="0" max="100" step="0.5" value={f.weekend} onChange={(e) => setF({ ...f, weekend: e.target.value })} /></Field>
        <Field id={id("w7")} label="7+ days off %"><Input id={id("w7")} type="number" min="0" max="90" step="0.5" value={f.weekly} onChange={(e) => setF({ ...f, weekly: e.target.value })} /></Field>
        <Field id={id("w28")} label="28+ days off %"><Input id={id("w28")} type="number" min="0" max="90" step="0.5" value={f.monthly} onChange={(e) => setF({ ...f, monthly: e.target.value })} /></Field>
        <Field id={id("min")} label="Min days"><Input id={id("min")} type="number" min="1" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} /></Field>
        <Field id={id("max")} label="Max days"><Input id={id("max")} type="number" min="1" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} placeholder="none" /></Field>
        <div className="flex items-center gap-3 sm:col-span-3 lg:col-span-6">
          <Button type="submit" disabled={save.busy}>Save price</Button>
          <Status message={save.message} ok={save.ok} />
        </div>
      </form>

      <div className="flex flex-col gap-2 border-t border-border pt-(--space-sm)">
        <h4 className="text-sm font-medium text-foreground">Seasonal prices</h4>
        {plan.seasons.length === 0 && <p className="text-sm text-muted-foreground">None. The daily price applies all year.</p>}
        <ul className="flex flex-col divide-y divide-border text-sm">
          {plan.seasons.map((season) => (
            <li key={season.id} className="flex items-center justify-between py-1.5">
              <span>{season.start_date} to {season.end_date}: {season.daily.toFixed(2)} per day</span>
              <Button type="button" size="icon" variant="ghost" aria-label="Remove season" onClick={() => void send(`/api/provider/seasons/${season.id}`, "DELETE").then(onChanged)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        <form onSubmit={addSeason} className="grid items-end gap-(--space-sm) sm:grid-cols-4">
          <Field id={id("ss")} label="From"><Input id={id("ss")} type="date" value={s.start} onChange={(e) => setS({ ...s, start: e.target.value })} required /></Field>
          <Field id={id("se")} label="To (included)"><Input id={id("se")} type="date" value={s.end} onChange={(e) => setS({ ...s, end: e.target.value })} required /></Field>
          <Field id={id("sd")} label="Daily price"><Input id={id("sd")} type="number" min="0" step="0.01" value={s.daily} onChange={(e) => setS({ ...s, daily: e.target.value })} required /></Field>
          <Button type="submit" variant="outline" disabled={seasonSave.busy}>Add season</Button>
        </form>
        <Status message={seasonSave.message} ok={seasonSave.ok} />
      </div>
    </div>
  );
}

function PricesTab() {
  const [refresh, setRefresh] = useState(0);
  const plans = useApiData<{ data: Plan[] }>(`/api/provider/rate-plans?_r=${refresh}`);
  if (plans.status === "loading") return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (plans.status === "error") return <p className="text-sm text-destructive">{plans.error}</p>;
  if (plans.data.data.length === 0) return <p className="text-sm text-muted-foreground">Add a car first. Its price appears here.</p>;
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
    }, "Extra added.");
  }

  return (
    <div className="flex flex-col gap-(--space-sm)">
      {extras.status === "success" && extras.data.data.length === 0 && <p className="text-sm text-muted-foreground">No extras yet.</p>}
      <ul className="flex flex-col divide-y divide-border text-sm">
        {extras.status === "success" && extras.data.data.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              <span className="font-medium text-foreground">{x.name}</span> <span className="text-muted-foreground">({x.code}) {x.unit_price.toFixed(2)} {x.currency} {x.pricing === "per_day" ? "per day" : "per rental"}, up to {x.max_quantity}</span>
              {x.is_mandatory && <Badge variant="outline" className="ml-2">Included</Badge>}
              {!x.is_active && <Badge variant="outline" className="ml-2">Off</Badge>}
            </span>
            <span className="flex gap-1.5">
              <Button type="button" size="sm" variant="outline" onClick={() => void send(`/api/provider/extras/${x.id}`, "PATCH", { is_active: !x.is_active }).then(changed)}>{x.is_active ? "Switch off" : "Switch on"}</Button>
              <Button type="button" size="icon" variant="ghost" aria-label={`Delete ${x.name}`} onClick={() => void send(`/api/provider/extras/${x.id}`, "DELETE").then(changed)}><Trash2 /></Button>
            </span>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="grid items-end gap-(--space-sm) rounded-xl border border-border p-(--space-sm) sm:grid-cols-3 lg:grid-cols-6">
        <Field id="ex-code" label="Code"><Input id="ex-code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required placeholder="child-seat" /></Field>
        <Field id="ex-name" label="Name"><Input id="ex-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
        <Field id="ex-kind" label="Type">
          <select id="ex-kind" className={selectClass} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="extra">Extra</option><option value="insurance">Insurance</option></select>
        </Field>
        <Field id="ex-pricing" label="Charged">
          <select id="ex-pricing" className={selectClass} value={f.pricing} onChange={(e) => setF({ ...f, pricing: e.target.value })}><option value="per_day">Per day</option><option value="per_rental">Once</option></select>
        </Field>
        <Field id="ex-price" label="Price"><Input id="ex-price" type="number" min="0" step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} required /></Field>
        <Field id="ex-max" label="Max quantity"><Input id="ex-max" type="number" min="1" max="20" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={f.mandatory} onChange={(e) => setF({ ...f, mandatory: e.target.checked })} /> Always included in the price</label>
        <div className="flex items-center gap-3 sm:col-span-3 lg:col-span-4"><Button type="submit" disabled={save.busy}>Add extra</Button><Status message={save.message} ok={save.ok} /></div>
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
  const [f, setF] = useState(initial);
  const save = useSave();

  function setTier(i: number, patch: Partial<{ hours_before: number; refund_pct: number }>) {
    setF({ ...f, cancellation_tiers: f.cancellation_tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void save.run(() => send("/api/provider/policy", "PUT", f));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-(--space-md)">
      <div className="grid gap-(--space-sm) sm:grid-cols-3">
        <Field id="po-dt" label="Security deposit">
          <select id="po-dt" className={selectClass} value={f.deposit_type} onChange={(e) => setF({ ...f, deposit_type: e.target.value as "fixed" | "percent" })}><option value="fixed">Fixed amount ({currency})</option><option value="percent">Percent of the rental</option></select>
        </Field>
        <Field id="po-dv" label={f.deposit_type === "fixed" ? `Amount (${currency})` : "Percent"}><Input id="po-dv" type="number" min="0" step="0.01" value={f.deposit_value} onChange={(e) => setF({ ...f, deposit_value: Number(e.target.value) })} /></Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-foreground">Cancellation refunds</legend>
        <p className="text-xs text-muted-foreground">If a customer cancels at least this many hours before pick-up, they get this share of the price back. The earliest matching row wins.</p>
        {f.cancellation_tiers.map((t, i) => (
          <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Field id={`po-h${i}`} label="Hours before pick-up"><Input id={`po-h${i}`} type="number" min="0" max="720" value={t.hours_before} onChange={(e) => setTier(i, { hours_before: Number(e.target.value) })} /></Field>
            <Field id={`po-r${i}`} label="Refund %"><Input id={`po-r${i}`} type="number" min="0" max="100" value={t.refund_pct} onChange={(e) => setTier(i, { refund_pct: Number(e.target.value) })} /></Field>
            <Button type="button" size="icon" variant="ghost" aria-label="Remove row" onClick={() => setF({ ...f, cancellation_tiers: f.cancellation_tiers.filter((_, j) => j !== i) })}><Trash2 /></Button>
          </div>
        ))}
        {f.cancellation_tiers.length < 6 && (
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setF({ ...f, cancellation_tiers: [...f.cancellation_tiers, { hours_before: 0, refund_pct: 0 }] })}>Add a row</Button>
        )}
      </fieldset>

      <div className="grid gap-(--space-sm) sm:grid-cols-3">
        <Field id="po-age" label="Minimum driver age"><Input id="po-age" type="number" min="16" max="30" value={f.min_driver_age} onChange={(e) => setF({ ...f, min_driver_age: Number(e.target.value) })} /></Field>
        <Field id="po-yage" label="Young driver under (blank for none)"><Input id="po-yage" type="number" min="18" max="30" value={f.young_driver_age ?? ""} onChange={(e) => setF({ ...f, young_driver_age: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
        <Field id="po-yfee" label={`Young driver fee per day (${currency})`}><Input id="po-yfee" type="number" min="0" step="0.01" value={f.young_driver_fee} onChange={(e) => setF({ ...f, young_driver_fee: Number(e.target.value) })} /></Field>
      </div>

      <div className="flex items-center gap-3"><Button type="submit" disabled={save.busy}>Save policy</Button><Status message={save.message} ok={save.ok} /></div>
    </form>
  );
}

function PolicyTab() {
  const policy = useApiData<{ data: PolicyForm; currency: string }>("/api/provider/policy");
  if (policy.status === "loading") return <p className="text-sm text-muted-foreground">Loading...</p>;
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
    }, "Code created.");
  }

  return (
    <div className="flex flex-col gap-(--space-sm)">
      {promos.status === "success" && promos.data.data.length === 0 && <p className="text-sm text-muted-foreground">No promo codes yet.</p>}
      <ul className="flex flex-col divide-y divide-border text-sm">
        {promos.status === "success" && promos.data.data.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span><span className="font-mono font-medium text-foreground">{p.code}</span> <span className="text-muted-foreground">{p.discount_type === "percent" ? `${p.value}% off` : `${p.value.toFixed(2)} off`}, from {p.min_days} day(s)</span>{!p.is_active && <Badge variant="outline" className="ml-2">Off</Badge>}</span>
            <span className="flex gap-1.5">
              <Button type="button" size="sm" variant="outline" onClick={() => void send(`/api/provider/promos/${p.id}`, "PATCH", { is_active: !p.is_active }).then(changed)}>{p.is_active ? "Switch off" : "Switch on"}</Button>
              <Button type="button" size="icon" variant="ghost" aria-label={`Delete ${p.code}`} onClick={() => void send(`/api/provider/promos/${p.id}`, "DELETE").then(changed)}><Trash2 /></Button>
            </span>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="grid items-end gap-(--space-sm) rounded-xl border border-border p-(--space-sm) sm:grid-cols-3 lg:grid-cols-6">
        <Field id="pr-code" label="Code"><Input id="pr-code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required placeholder="SUMMER25" /></Field>
        <Field id="pr-type" label="Discount"><select id="pr-type" className={selectClass} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="percent">Percent</option><option value="fixed">Fixed amount</option></select></Field>
        <Field id="pr-val" label="Value"><Input id="pr-val" type="number" min="0" step="0.01" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} required /></Field>
        <Field id="pr-min" label="Min days"><Input id="pr-min" type="number" min="1" value={f.minDays} onChange={(e) => setF({ ...f, minDays: e.target.value })} /></Field>
        <Field id="pr-from" label="Valid from"><Input id="pr-from" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field id="pr-to" label="Valid to"><Input id="pr-to" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <div className="flex items-center gap-3 sm:col-span-3 lg:col-span-6"><Button type="submit" disabled={save.busy}>Create code</Button><Status message={save.message} ok={save.ok} /></div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------
// One-way fees
// ---------------------------------------------------------------

function OneWayTab() {
  const [refresh, setRefresh] = useState(0);
  const branches = useApiData<{ data: { id: number; name: string; city: string }[] }>("/api/provider/branches");
  const fees = useApiData<{ data: { from_branch_id: number; to_branch_id: number; amount: number }[] }>(`/api/provider/one-way-fees?_r=${refresh}`);
  const [f, setF] = useState({ from: "", to: "", amount: "" });
  const save = useSave();

  const list = branches.status === "success" ? branches.data.data : [];
  const name = (id: number) => list.find((b) => b.id === id)?.name ?? String(id);
  if (branches.status === "success" && list.length < 2) return <p className="text-sm text-muted-foreground">One-way fees apply when you have at least two branches.</p>;

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
            <span>{name(x.from_branch_id)} to {name(x.to_branch_id)}: {x.amount.toFixed(2)}</span>
            <Button type="button" size="icon" variant="ghost" aria-label="Remove fee" onClick={() => void send(`/api/provider/one-way-fees?from=${x.from_branch_id}&to=${x.to_branch_id}`, "DELETE").then(() => setRefresh((n) => n + 1))}><Trash2 /></Button>
          </li>
        ))}
      </ul>
      <form onSubmit={set} className="grid items-end gap-(--space-sm) rounded-xl border border-border p-(--space-sm) sm:grid-cols-4">
        <Field id="ow-from" label="From"><select id="ow-from" className={selectClass} value={f.from || String(list[0]?.id ?? "")} onChange={(e) => setF({ ...f, from: e.target.value })}>{list.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        <Field id="ow-to" label="To"><select id="ow-to" className={selectClass} value={f.to || String(list[1]?.id ?? "")} onChange={(e) => setF({ ...f, to: e.target.value })}>{list.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        <Field id="ow-amt" label="Fee"><Input id="ow-amt" type="number" min="0" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></Field>
        <div className="flex items-center gap-3"><Button type="submit" disabled={save.busy}>Set fee</Button></div>
      </form>
      <Status message={save.message} ok={save.ok} />
    </div>
  );
}

// ---------------------------------------------------------------

const TABS = [
  { id: "prices", label: "Prices", body: () => <PricesTab /> },
  { id: "extras", label: "Extras", body: () => <ExtrasTab /> },
  { id: "policy", label: "Cancellation & deposit", body: () => <PolicyTab /> },
  { id: "promos", label: "Promo codes", body: () => <PromosTab /> },
  { id: "oneway", label: "One-way fees", body: () => <OneWayTab /> },
] as const;

export function PricingManager({ individual }: { individual: boolean }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("prices");
  const tabs = individual ? TABS.filter((t) => t.id !== "oneway") : TABS;
  const current = tabs.find((t) => t.id === tab) ?? tabs[0]!;

  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">Pricing</h1>
        <p className="text-sm text-muted-foreground">Changes apply to new quotes. Bookings already made keep the price and terms they were quoted.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Pricing sections">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={current.id === t.id} onClick={() => setTab(t.id)}
            className={cn("rounded-full border px-3 py-1 text-sm", current.id === t.id ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>
      <Card className="shadow-card ring-0"><CardContent>{current.body()}</CardContent></Card>
    </div>
  );
}
