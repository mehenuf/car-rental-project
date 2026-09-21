"use client";

import { AttestationCard } from "@/components/provider/attestation-card";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiData } from "@/hooks/use-api-data";
import { Status, send, useSave } from "@/components/provider/form-utils";
import { formatMinor } from "@/lib/pricing/money";

interface Branch {
  id: number;
  name: string;
  city: string;
  currency: string;
  timezone: string;
  turnaround_minutes: number;
  pickup_surcharge_minor: number;
  is_active: boolean;
  address: string | null;
}

function ProfileForm({ canEdit }: { canEdit: boolean }) {
  const profile = useApiData<{ data: { display_name: string; contact_phone: string | null; legal_name: string; status: string; registration_number: string | null } }>("/api/provider/profile");
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const save = useSave();
  if (profile.status !== "success") return <p role={profile.status === "error" ? "alert" : "status"} className={profile.status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{profile.status === "error" ? profile.error : "Loading..."}</p>;
  const p = profile.data.data;

  function submit(e: FormEvent) {
    e.preventDefault();
    void save.run(() => send("/api/provider/profile", "PATCH", { display_name: name ?? p.display_name, contact_phone: phone ?? p.contact_phone ?? undefined }));
  }
  return (
    <form onSubmit={submit} className="grid gap-(--space-sm) sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pf-name">Name customers see</Label>
        <Input id="pf-name" value={name ?? p.display_name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pf-phone">Contact phone</Label>
        <Input id="pf-phone" value={phone ?? p.contact_phone ?? ""} onChange={(e) => setPhone(e.target.value)} disabled={!canEdit} />
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2">
        Legal name: {p.legal_name}
        {p.registration_number ? ` · Registration ${p.registration_number}` : ""} · Account status: {p.status}. To change the legal name or currency, contact support.
      </p>
      {canEdit && (
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={save.busy}>Save profile</Button>
          <Status message={save.message} ok={save.ok} />
        </div>
      )}
    </form>
  );
}

function BranchEditor({ branch, canEdit, onSaved }: { branch: Branch; canEdit: boolean; onSaved: () => void }) {
  const [name, setName] = useState(branch.name);
  const [address, setAddress] = useState(branch.address ?? "");
  const [turnaround, setTurnaround] = useState(String(branch.turnaround_minutes));
  const [surcharge, setSurcharge] = useState(String(branch.pickup_surcharge_minor / 100));
  const save = useSave();

  function submit(e: FormEvent) {
    e.preventDefault();
    void save.run(async () => {
      await send(`/api/provider/branches/${branch.id}`, "PATCH", {
        name,
        address: address || undefined,
        turnaround_minutes: Number(turnaround),
        pickup_surcharge: Number(surcharge),
      });
      onSaved();
    });
  }
  return (
    <form onSubmit={submit} className="grid gap-(--space-sm) rounded-xl border border-border p-(--space-sm) sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`br-name-${branch.id}`}>Branch name ({branch.city})</Label>
        <Input id={`br-name-${branch.id}`} value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`br-addr-${branch.id}`}>Address (private)</Label>
        <Input id={`br-addr-${branch.id}`} value={address} onChange={(e) => setAddress(e.target.value)} disabled={!canEdit} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`br-turn-${branch.id}`}>Turnaround between rentals (minutes)</Label>
        <Input id={`br-turn-${branch.id}`} type="number" min={0} max={720} value={turnaround} onChange={(e) => setTurnaround(e.target.value)} disabled={!canEdit} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`br-sur-${branch.id}`}>Pick-up surcharge ({branch.currency})</Label>
        <Input id={`br-sur-${branch.id}`} type="number" min={0} step="0.01" value={surcharge} onChange={(e) => setSurcharge(e.target.value)} disabled={!canEdit} />
        <p className="text-xs text-muted-foreground">Currently {formatMinor(branch.pickup_surcharge_minor, branch.currency)}. Time zone: {branch.timezone}.</p>
      </div>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={save.busy}>Save branch</Button>
          <Button
            type="button"
            variant="outline"
            disabled={save.busy}
            onClick={() => void save.run(async () => { await send(`/api/provider/branches/${branch.id}`, "PATCH", { is_active: !branch.is_active }); onSaved(); }, branch.is_active ? "Branch switched off." : "Branch switched on.")}
          >
            {branch.is_active ? "Switch off" : "Switch on"}
          </Button>
          <Status message={save.message} ok={save.ok} />
        </div>
      )}
    </form>
  );
}

function BranchesSection({ canEdit, individual }: { canEdit: boolean; individual: boolean }) {
  const [refresh, setRefresh] = useState(0);
  const branches = useApiData<{ data: Branch[] }>(`/api/provider/branches?_r=${refresh}`);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: "", city: "", address: "" });
  const save = useSave();

  function addBranch(e: FormEvent) {
    e.preventDefault();
    void save.run(async () => {
      await send("/api/provider/branches", "POST", { name: f.name, city: f.city, address: f.address, timezone: "UTC" });
      setAdding(false);
      setF({ name: "", city: "", address: "" });
      setRefresh((n) => n + 1);
    }, "Branch added.");
  }

  if (branches.status !== "success") return <p role={branches.status === "error" ? "alert" : "status"} className={branches.status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{branches.status === "error" ? branches.error : "Loading..."}</p>;
  return (
    <div className="flex flex-col gap-(--space-sm)">
      {branches.data.data.map((b) => (
        <BranchEditor key={`${b.id}-${refresh}`} branch={b} canEdit={canEdit} onSaved={() => setRefresh((n) => n + 1)} />
      ))}
      {canEdit && !individual && (
        <>
          {!adding ? (
            <Button type="button" variant="outline" className="self-start" onClick={() => setAdding(true)}>Add a branch</Button>
          ) : (
            <form onSubmit={addBranch} className="grid gap-(--space-sm) rounded-xl border border-border p-(--space-sm) sm:grid-cols-3">
              <Input aria-label="Branch name" placeholder="Branch name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
              <Input aria-label="City" placeholder="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} required />
              <Input aria-label="Address" placeholder="Address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} required />
              <div className="flex items-center gap-3 sm:col-span-3">
                <Button type="submit" disabled={save.busy}>Add branch</Button>
                <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
                <Status message={save.message} ok={save.ok} />
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}

function PayoutAccountForm({ canEdit }: { canEdit: boolean }) {
  const [refresh, setRefresh] = useState(0);
  const account = useApiData<{ data: { account_holder: string; bank_name: string; account_last4: string; country_code: string } | null }>(`/api/provider/payout-account?_r=${refresh}`);
  const [f, setF] = useState({ holder: "", bank: "", number: "", country: "US" });
  const save = useSave();

  function submit(e: FormEvent) {
    e.preventDefault();
    void save.run(async () => {
      await send("/api/provider/payout-account", "PUT", { account_holder: f.holder, bank_name: f.bank, account_number: f.number, country_code: f.country });
      setF({ ...f, number: "" });
      setRefresh((n) => n + 1);
    });
  }

  const current = account.status === "success" ? account.data.data : null;
  return (
    <div className="flex flex-col gap-(--space-sm)">
      <p className="text-sm text-muted-foreground">
        {current ? `Payouts go to ${current.account_holder}, ${current.bank_name}, account ending ${current.account_last4}.` : "No payout account yet. Earnings are held until you add one."} Only the last four digits are stored, and payouts are simulated in this demo.
      </p>
      {canEdit && (
        <form onSubmit={submit} className="grid gap-(--space-sm) sm:grid-cols-2">
          <Input aria-label="Account holder" placeholder="Account holder" value={f.holder} onChange={(e) => setF({ ...f, holder: e.target.value })} required />
          <Input aria-label="Bank name" placeholder="Bank name" value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })} required />
          <Input aria-label="Account number or IBAN" placeholder="Account number or IBAN" value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} autoComplete="off" required />
          <Input aria-label="Country code" placeholder="Country code (US)" maxLength={2} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} required />
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={save.busy}>Save payout account</Button>
            <Status message={save.message} ok={save.ok} />
          </div>
        </form>
      )}
    </div>
  );
}

function DocumentsSection() {
  const docs = useApiData<{ data: { id: string; fleet_unit_id: string | null; kind: string; file_name: string; status: string; review_note: string | null }[] }>("/api/provider/documents");
  const [error, setError] = useState<string | null>(null);

  async function view(id: string) {
    setError(null);
    const res = await fetch(`/api/provider/documents/${id}/url`);
    const body = await res.json();
    if (!res.ok) return setError(body?.error?.message ?? "Could not open the file.");
    window.open(body.url, "_blank", "noopener");
  }

  if (docs.status !== "success") return <p role={docs.status === "error" ? "alert" : "status"} className={docs.status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{docs.status === "error" ? docs.error : "Loading..."}</p>;
  return (
    <div className="flex flex-col gap-2">
      {docs.data.data.length === 0 && <p className="text-sm text-muted-foreground">No documents uploaded.</p>}
      <ul className="flex flex-col divide-y divide-border text-sm">
        {docs.data.data.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              <span className="font-medium text-foreground">{d.kind.replace(/_/g, " ")}</span>{" "}
              <span className="text-muted-foreground">{d.file_name} ({d.status})</span>
              {d.review_note && <span className="block text-destructive">{d.review_note}</span>}
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => view(d.id)}>View</Button>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function SettingsPanel({ individual, role }: { individual: boolean; role: "owner" | "manager" | "agent" }) {
  const canEdit = role !== "agent";
  const owner = role === "owner";
  const sections = [
    { title: "Profile", body: <ProfileForm canEdit={canEdit} /> },
    { title: individual ? "Pick-up location" : "Branches", body: <BranchesSection canEdit={canEdit} individual={individual} /> },
    { title: "Payout account", body: <PayoutAccountForm canEdit={owner} /> },
    { title: "Verification documents", body: <DocumentsSection /> },
    ...(individual ? [{ title: "Insurance", body: <AttestationCard /> }] : []),
  ];
  return (
    <div className="flex flex-col gap-(--space-md)">
      <h1 className="font-heading text-2xl font-bold text-foreground">Settings</h1>
      {sections.map((s) => (
        <Card key={s.title} className="shadow-card ring-0">
          <CardContent className="flex flex-col gap-(--space-sm)">
            <h2 className="font-heading text-lg font-semibold text-foreground">{s.title}</h2>
            {s.body}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
