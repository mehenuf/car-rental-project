"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiData } from "@/hooks/use-api-data";
import { buildUnitRow, monthDays, type CellState } from "@/lib/provider/calendar";
import { cn } from "@/lib/utils";

interface CalendarUnit {
  id: string;
  plate: string;
  vehicle_name: string;
  requires_window: boolean;
  timezone: string;
  occupancy: { id: string; reason: "booking" | "transfer" | "maintenance" | "owner_block"; reference: string | null; start: string; end: string }[];
  windows: { id: string; start: string; end: string }[];
}

const CELL_CLASS: Record<CellState, string> = {
  free: "bg-emerald-500/25",
  booking: "bg-primary",
  transfer: "bg-primary/50",
  maintenance: "bg-amber-500",
  owner_block: "bg-slate-400",
  unavailable: "bg-muted",
};

const LEGEND: { state: CellState; label: string }[] = [
  { state: "free", label: "Free" },
  { state: "booking", label: "Booked" },
  { state: "maintenance", label: "Maintenance" },
  { state: "owner_block", label: "Blocked by you" },
  { state: "unavailable", label: "Not offered" },
];

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

const dayOf = (iso: string, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(iso));

/** Month view of every car: bookings, maintenance, blocks and (for private owners) the windows a car may be booked in. */
export function CalendarView({ individual, canWrite }: { individual: boolean; canWrite: boolean }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [refresh, setRefresh] = useState(0);
  const result = useApiData<{ units: CalendarUnit[] }>(`/api/provider/calendar?month=${month}&_r=${refresh}`);

  const [unitId, setUnitId] = useState("");
  const [kind, setKind] = useState<"window" | "block">(individual ? "window" : "block");
  const [reason, setReason] = useState<"maintenance" | "owner_block">("maintenance");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => monthDays(month), [month]);
  const units = useMemo(() => (result.status === "success" ? result.data.units : []), [result]);

  const rows = useMemo(
    () =>
      units.map((u) => ({
        unit: u,
        cells: buildUnitRow(
          days,
          u.timezone,
          u.occupancy.map((o) => ({ reason: o.reason, start: new Date(o.start), end: new Date(o.end) })),
          u.requires_window ? u.windows.map((w) => ({ start: new Date(w.start), end: new Date(w.end) })) : null
        ),
      })),
    [units, days]
  );

  async function add(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/provider/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, fleet_unit_id: unitId || units[0]?.id, start_date: start, end_date: end, block_reason: kind === "block" ? reason : undefined }),
      });
      const body = await res.json();
      if (!res.ok) {
        const issue = body?.error?.issues?.[0];
        throw new Error(issue ? issue.message : (body?.error?.message ?? "Could not save."));
      }
      setStart("");
      setEnd("");
      setRefresh((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(kindToRemove: "window" | "block", id: string) {
    setError(null);
    const res = await fetch(`/api/provider/availability/${kindToRemove}/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return setError(body?.error?.message ?? "Could not remove it.");
    }
    setRefresh((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold text-foreground">{individual ? "Availability" : "Calendar"}</h1>
          <p className="text-sm text-muted-foreground">
            {individual ? "Your car can only be booked on the days you open below." : "Every car, every day. Block days for maintenance or your own use."}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" size="icon" variant="outline" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
            <ChevronLeft />
          </Button>
          <span className="min-w-28 text-center font-medium text-foreground">{month}</span>
          <Button type="button" size="icon" variant="outline" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground" aria-label="Legend">
        {LEGEND.map((l) => (
          <span key={l.state} className="inline-flex items-center gap-1.5">
            <span className={cn("size-3 rounded-sm", CELL_CLASS[l.state])} aria-hidden /> {l.label}
          </span>
        ))}
      </div>

      <Card className="shadow-card ring-0">
        <CardContent className="overflow-x-auto p-(--space-sm)">
          {result.status === "loading" && <p className="text-sm text-muted-foreground">Loading...</p>}
          {result.status === "error" && <p className="text-sm text-destructive">{result.error}</p>}
          {result.status === "success" && units.length === 0 && <p className="text-sm text-muted-foreground">Add a car first.</p>}
          {rows.length > 0 && (
            <table className="w-full border-separate border-spacing-y-1 text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-card pr-3 text-left font-medium text-muted-foreground">Car</th>
                  {days.map((d) => (
                    <th key={d} className="w-5 min-w-5 text-center font-normal text-muted-foreground">{Number(d.slice(8))}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ unit, cells }) => (
                  <tr key={unit.id}>
                    <th scope="row" className="sticky left-0 whitespace-nowrap bg-card pr-3 text-left font-medium text-foreground">
                      {unit.vehicle_name} <span className="font-normal text-muted-foreground">{unit.plate}</span>
                    </th>
                    {cells.map((state, i) => (
                      <td key={days[i]} className="p-0">
                        <span
                          className={cn("mx-px block h-6 rounded-sm", CELL_CLASS[state])}
                          title={`${days[i]}: ${state.replace("_", " ")}`}
                          aria-label={`${unit.plate} ${days[i]} ${state.replace("_", " ")}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {canWrite && units.length > 0 && (
        <Card className="shadow-card ring-0">
          <CardContent className="flex flex-col gap-(--space-sm)">
            <h2 className="font-heading text-lg font-semibold text-foreground">Add a period</h2>
            <form onSubmit={add} className="grid gap-(--space-sm) sm:grid-cols-2 lg:grid-cols-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="av-unit">Car</Label>
                <select id="av-unit" value={unitId || units[0]?.id} onChange={(e) => setUnitId(e.target.value)} className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                  {units.map((u) => <option key={u.id} value={u.id}>{u.vehicle_name} {u.plate}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="av-kind">Type</Label>
                <select id="av-kind" value={kind} onChange={(e) => setKind(e.target.value as "window" | "block")} className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                  {individual && <option value="window">Open for booking</option>}
                  <option value="block">Block days</option>
                </select>
              </div>
              {kind === "block" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="av-reason">Reason</Label>
                  <select id="av-reason" value={reason} onChange={(e) => setReason(e.target.value as "maintenance" | "owner_block")} className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                    <option value="maintenance">Maintenance</option>
                    <option value="owner_block">I need the car</option>
                  </select>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="av-start">From</Label>
                <Input id="av-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="av-end">To (included)</Label>
                <Input id="av-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} required />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save"}</Button>
              </div>
            </form>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

            <ul className="flex flex-col divide-y divide-border text-sm">
              {units.flatMap((u) => [
                ...u.windows.map((w) => ({ key: `w-${w.id}`, kind: "window" as const, id: w.id, label: `${u.plate}: open ${dayOf(w.start, u.timezone)} to ${dayOf(new Date(new Date(w.end).getTime() - 1).toISOString(), u.timezone)}` })),
                ...u.occupancy.filter((o) => o.reason === "maintenance" || o.reason === "owner_block").map((o) => ({ key: `b-${o.id}`, kind: "block" as const, id: o.id, label: `${u.plate}: ${o.reason === "maintenance" ? "maintenance" : "blocked"} ${dayOf(o.start, u.timezone)} to ${dayOf(new Date(new Date(o.end).getTime() - 1).toISOString(), u.timezone)}` })),
              ]).map((item) => (
                <li key={item.key} className="flex items-center justify-between py-1.5">
                  <span>{item.label}</span>
                  <Button type="button" size="icon" variant="ghost" aria-label="Remove" onClick={() => remove(item.kind, item.id)}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
