"use client";

import { useRef, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiData } from "@/hooks/use-api-data";
import { uploadDocument } from "@/lib/provider/upload-client";
import type { DocumentKind, ListingStatus } from "@/types/database";

interface Unit {
  id: string;
  branch_id: number;
  plate: string;
  vin: string | null;
  mileage_km: number;
  status: "active" | "maintenance" | "retired";
  requires_window: boolean;
  listing_status: ListingStatus;
  review_note: string | null;
  vehicle_name: string;
  branch_name: string;
}

interface UnitDoc {
  id: string;
  fleet_unit_id: string | null;
  kind: DocumentKind;
  file_name: string;
  status: string;
  review_note: string | null;
}

const LISTING_LABEL: Record<ListingStatus, string> = {
  draft: "Draft",
  pending_review: "Waiting for review",
  approved: "Live",
  rejected: "Rejected",
};

async function call(url: string, method: string, body?: unknown): Promise<void> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error?.message ?? "Something went wrong.");
  }
}

/** A private owner's paperwork for one car: registration and insurance. */
function UnitDocumentsDialog({ unit, onClose }: { unit: Unit | null; onClose: () => void }) {
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState<DocumentKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Partial<Record<DocumentKind, HTMLInputElement | null>>>({});
  const docs = useApiData<{ data: UnitDoc[] }>(unit ? `/api/provider/documents?_r=${refresh}` : null);

  async function upload(kind: DocumentKind, file: File) {
    if (!unit) return;
    setError(null);
    setBusy(kind);
    try {
      await uploadDocument({ kind, file, fleetUnitId: unit.id });
      setRefresh((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The upload failed.");
    } finally {
      setBusy(null);
    }
  }

  const mine = docs.status === "success" ? docs.data.data.filter((d) => d.fleet_unit_id === unit?.id) : [];
  return (
    <Dialog open={unit !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Documents for {unit?.vehicle_name}</DialogTitle>
          <DialogDescription>Upload the registration and your insurance certificate, then submit the car for review.</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2">
          {(["vehicle_registration", "insurance"] as const).map((kind) => {
            const latest = mine.filter((d) => d.kind === kind).at(-1);
            return (
              <li key={kind} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2 text-sm">
                <span>
                  <span className="font-medium text-foreground">{kind === "insurance" ? "Insurance certificate" : "Vehicle registration"}</span>
                  <span className="block text-muted-foreground">{latest ? `${latest.file_name} (${latest.status})` : "Not uploaded yet"}</span>
                  {latest?.status === "rejected" && latest.review_note && <span className="block text-destructive">{latest.review_note}</span>}
                </span>
                <input
                  ref={(el) => {
                    inputs.current[kind] = el;
                  }}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  className="sr-only"
                  aria-label={`Upload ${kind.replace("_", " ")}`}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(kind, file);
                    e.target.value = "";
                  }}
                />
                <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => inputs.current[kind]?.click()}>
                  {busy === kind ? "Uploading..." : latest ? "Replace" : "Upload"}
                </Button>
              </li>
            );
          })}
        </ul>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}

export function FleetManager({ individual, canWrite }: { individual: boolean; canWrite: boolean }) {
  const [refresh, setRefresh] = useState(0);
  const [adding, setAdding] = useState(false);
  const [docsFor, setDocsFor] = useState<Unit | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const units = useApiData<{ data: Unit[] }>(`/api/provider/units?_r=${refresh}`);
  const branches = useApiData<{ data: { id: number; name: string; city: string }[] }>("/api/provider/branches");
  const catalogue = useApiData<{ data: { id: string; name: string }[] }>(adding ? "/api/vehicles?fields=card&pageSize=100&sortBy=name&sortOrder=asc" : null);

  const [vehicleId, setVehicleId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [plate, setPlate] = useState("");
  const [vin, setVin] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = units.status === "success" ? units.data.data : [];
  const branchList = branches.status === "success" ? branches.data.data : [];

  async function act(fn: () => Promise<void>) {
    setMessage(null);
    try {
      await fn();
      setRefresh((n) => n + 1);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function addCar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/provider/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id: vehicleId,
          branch_id: Number(branchId || branchList[0]?.id),
          plate,
          vin: vin.trim() || null,
          daily_price: price.trim() ? Number(price) : null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not add the car.");
      setAdding(false);
      setPlate("");
      setVin("");
      setPrice("");
      setRefresh((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the car.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold text-foreground">{individual ? "My cars" : "Fleet"}</h1>
          <p className="text-sm text-muted-foreground">
            {individual
              ? "Each car is reviewed before it goes live. Set when it can be booked on the Availability page."
              : "Your cars are live as soon as you add them. Take one off the road by setting it to maintenance or retired."}
          </p>
        </div>
        {canWrite && (
          <Button type="button" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden /> Add a car
          </Button>
        )}
      </div>

      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}

      <Card className="shadow-card ring-0">
        <CardContent className="p-0">
          {units.status === "loading" && <p className="p-(--space-sm) text-sm text-muted-foreground">Loading...</p>}
          {units.status === "error" && <p className="p-(--space-sm) text-sm text-destructive">{units.error}</p>}
          {units.status === "success" && rows.length === 0 && <p className="p-(--space-sm) text-sm text-muted-foreground">No cars yet.</p>}
          {rows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Car</TableHead>
                  <TableHead>Plate</TableHead>
                  {!individual && <TableHead>Branch</TableHead>}
                  <TableHead>Mileage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Listing</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.vehicle_name}</TableCell>
                    <TableCell>{u.plate}</TableCell>
                    {!individual && <TableCell>{u.branch_name}</TableCell>}
                    <TableCell>{u.mileage_km.toLocaleString()} km</TableCell>
                    <TableCell>
                      {canWrite ? (
                        <select
                          aria-label={`Status of ${u.plate}`}
                          value={u.status}
                          onChange={(e) => act(() => call(`/api/provider/units/${u.id}`, "PATCH", { status: e.target.value }))}
                          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                        >
                          <option value="active">Active</option>
                          <option value="maintenance">Maintenance</option>
                          <option value="retired">Retired</option>
                        </select>
                      ) : (
                        <span className="capitalize">{u.status}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{LISTING_LABEL[u.listing_status]}</Badge>
                      {u.listing_status === "rejected" && u.review_note && <span className="mt-1 block text-xs text-destructive">{u.review_note}</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {individual && canWrite && (u.listing_status === "draft" || u.listing_status === "rejected") && (
                        <span className="inline-flex gap-1.5">
                          <Button type="button" size="sm" variant="outline" onClick={() => setDocsFor(u)}>Documents</Button>
                          <Button type="button" size="sm" onClick={() => act(() => call(`/api/provider/units/${u.id}/submit`, "POST"))}>Submit for review</Button>
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a car</DialogTitle>
            <DialogDescription>Pick the model from our catalogue. {individual && "You will upload its documents next."}</DialogDescription>
          </DialogHeader>
          <form onSubmit={addCar} className="flex flex-col gap-(--space-sm)">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="car-model">Model</Label>
              <select id="car-model" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} required className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="" disabled>{catalogue.status === "loading" ? "Loading..." : "Choose a model"}</option>
                {catalogue.status === "success" && catalogue.data.data.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            {!individual && branchList.length > 1 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="car-branch">Branch</Label>
                <select id="car-branch" value={branchId || String(branchList[0]?.id ?? "")} onChange={(e) => setBranchId(e.target.value)} className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                  {branchList.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.city})</option>)}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="car-plate">Licence plate</Label>
              <Input id="car-plate" value={plate} onChange={(e) => setPlate(e.target.value)} required minLength={2} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="car-vin">VIN (optional)</Label>
              <Input id="car-vin" value={vin} onChange={(e) => setVin(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="car-price">Daily price</Label>
              <Input id="car-price" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
              <p className="text-xs text-muted-foreground">Needed if you have no price for this model yet. You can refine prices, seasons and extras later.</p>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter className="-mx-4 -mb-4">
              <Button type="button" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
              <Button type="submit" disabled={busy || !vehicleId}>{busy ? "Adding..." : "Add car"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <UnitDocumentsDialog unit={docsFor} onClose={() => setDocsFor(null)} />
    </div>
  );
}
