"use client";

import { useRef, useState, type FormEvent } from "react";
import { BookingStatusBadge } from "@/components/admin/booking-status-badge";
import { Status, send, useSave } from "@/components/provider/form-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApiData } from "@/hooks/use-api-data";
import { formatDate } from "@/lib/format";
import { formatMinor } from "@/lib/pricing/money";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { BookingStatus } from "@/types/database";

interface ProviderBooking {
  id: string;
  reference: string;
  status: BookingStatus;
  payment_status: string;
  customer_name: string;
  email: string;
  phone: string | null;
  pickup_at: string;
  dropoff_at: string;
  total_amount: number;
  currency: string | null;
  plate: string | null;
  vehicle_name: string | null;
  inspections: ("pickup" | "return")[];
}

const VIEWS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "active", label: "Out on rental" },
  { id: "past", label: "Past" },
  { id: "all", label: "All" },
] as const;

const FUEL = [
  { value: "empty", label: "Empty" },
  { value: "quarter", label: "1/4" },
  { value: "half", label: "1/2" },
  { value: "three_quarters", label: "3/4" },
  { value: "full", label: "Full" },
];

function InspectionDialog({ booking, kind, onClose, onDone }: { booking: ProviderBooking | null; kind: "pickup" | "return"; onClose: () => void; onDone: () => void }) {
  const [odometer, setOdometer] = useState("");
  const [fuel, setFuel] = useState("full");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const save = useSave();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!booking) return;
    void save.run(async () => {
      // Photos first: each goes straight to private storage with a one-time token.
      const paths: string[] = [];
      for (const file of files) {
        const res = await fetch(`/api/provider/bookings/${booking.id}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_name: file.name, mime_type: file.type, size_bytes: file.size }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "Could not upload a photo.");
        const { error } = await supabase.storage.from(body.bucket).uploadToSignedUrl(body.path, body.token, file);
        if (error) throw new Error(error.message);
        paths.push(body.path);
      }
      await send(`/api/provider/bookings/${booking.id}/inspection`, "POST", {
        kind,
        odometer_km: Number(odometer),
        fuel_level: fuel,
        notes: notes.trim() || null,
        photo_paths: paths,
      });
      setOdometer("");
      setNotes("");
      setFiles([]);
      onDone();
    }, kind === "pickup" ? "Car handed over." : "Car returned.");
  }

  return (
    <Dialog open={booking !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{kind === "pickup" ? "Hand over the car" : "Take the car back"}</DialogTitle>
          <DialogDescription>{booking?.reference} · {booking?.vehicle_name} {booking?.plate}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-(--space-sm)">
          <div className="grid gap-(--space-sm) sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="in-odo">Odometer (km)</Label>
              <Input id="in-odo" type="number" min="0" value={odometer} onChange={(e) => setOdometer(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="in-fuel">Fuel level</Label>
              <select id="in-fuel" value={fuel} onChange={(e) => setFuel(e.target.value)} className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                {FUEL.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="in-notes">Condition notes</Label>
            <Textarea id="in-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Scratches, dents, cleanliness..." />
          </div>
          <div className="flex flex-col gap-1.5">
            <input ref={fileInput} type="file" accept="image/jpeg,image/png" multiple className="sr-only" aria-label="Add photos" onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, 10))} />
            <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => fileInput.current?.click()}>Add photos</Button>
            {files.length > 0 && <p className="text-xs text-muted-foreground">{files.length} photo{files.length === 1 ? "" : "s"} ready to upload (JPG or PNG, up to 5 MB each).</p>}
          </div>
          <Status message={save.message} ok={save.ok} />
          <DialogFooter className="-mx-4 -mb-4">
            <Button type="button" variant="outline" onClick={onClose}>Close</Button>
            <Button type="submit" disabled={save.busy}>{save.busy ? "Saving..." : "Record"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BookingsManager({ canOperate, canCancel }: { canOperate: boolean; canCancel: boolean }) {
  const [view, setView] = useState<(typeof VIEWS)[number]["id"]>("upcoming");
  const [refresh, setRefresh] = useState(0);
  const [inspecting, setInspecting] = useState<{ booking: ProviderBooking; kind: "pickup" | "return" } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const result = useApiData<{ data: ProviderBooking[] }>(`/api/provider/bookings?view=${view}&_r=${refresh}`);
  const rows = result.status === "success" ? result.data.data : [];
  const changed = () => setRefresh((n) => n + 1);

  async function act(url: string) {
    setMessage(null);
    try {
      await send(url, "POST");
      changed();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">Bookings</h1>
        <p className="text-sm text-muted-foreground">Hand cars over and take them back. The payout is scheduled when a return is recorded.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Booking views">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)}
            className={cn("rounded-full border px-3 py-1 text-sm", view === v.id ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
            {v.label}
          </button>
        ))}
      </div>
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}

      <Card className="shadow-card ring-0">
        <CardContent className="flex flex-col divide-y divide-border p-0">
          {result.status === "loading" && <p className="p-(--space-sm) text-sm text-muted-foreground">Loading...</p>}
          {result.status === "error" && <p className="p-(--space-sm) text-sm text-destructive">{result.error}</p>}
          {result.status === "success" && rows.length === 0 && <p className="p-(--space-sm) text-sm text-muted-foreground">Nothing here.</p>}
          {rows.map((b) => {
            const pickupPassed = new Date(b.pickup_at) <= new Date();
            return (
              <div key={b.id} className="flex flex-col gap-2 p-(--space-sm) sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-0.5 text-sm">
                  <span className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                    {b.reference} <BookingStatusBadge status={b.status} />
                    <span className="font-normal text-muted-foreground">{b.payment_status.replace("_", " ")}</span>
                  </span>
                  <span className="text-muted-foreground">{b.vehicle_name ?? "Car"} {b.plate} · {formatDate(b.pickup_at)} to {formatDate(b.dropoff_at)} · {b.currency ? formatMinor(Math.round(b.total_amount * 100), b.currency) : b.total_amount}</span>
                  <span className="text-muted-foreground">{b.customer_name} · {b.email}{b.phone ? ` · ${b.phone}` : ""}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {canOperate && b.status === "confirmed" && <Button type="button" size="sm" onClick={() => setInspecting({ booking: b, kind: "pickup" })}>Hand over</Button>}
                  {canOperate && b.status === "active" && <Button type="button" size="sm" onClick={() => setInspecting({ booking: b, kind: "return" })}>Take back</Button>}
                  {canOperate && b.status === "confirmed" && pickupPassed && <Button type="button" size="sm" variant="outline" onClick={() => act(`/api/provider/bookings/${b.id}/no-show`)}>No-show</Button>}
                  {canCancel && (b.status === "pending" || b.status === "confirmed") && <Button type="button" size="sm" variant="outline" onClick={() => act(`/api/provider/bookings/${b.id}/cancel`)}>Cancel and refund</Button>}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <InspectionDialog
        booking={inspecting?.booking ?? null}
        kind={inspecting?.kind ?? "pickup"}
        onClose={() => setInspecting(null)}
        onDone={() => { setInspecting(null); changed(); }}
      />
    </div>
  );
}
