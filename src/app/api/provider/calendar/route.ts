import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { requireProviderAccess } from "@/lib/provider/context";
import { monthDays, nextDay, startOfDayInZone } from "@/lib/provider/calendar";
import { canAccessBranch } from "@/lib/provider/permissions";
import { CalendarQuerySchema } from "@/lib/provider/schemas";
import { supabaseAdmin } from "@/lib/supabase-server";

/** `[a,b)` text of a tstzrange -> ISO instants. */
function parseRange(text: string): { start: string; end: string } {
  const [rawStart = "", rawEnd = ""] = text.slice(1, -1).split(",");
  const iso = (s: string) => new Date(s.replace(/"/g, "").trim().replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00")).toISOString();
  return { start: iso(rawStart), end: iso(rawEnd) };
}

/**
 * GET /api/provider/calendar?month=YYYY-MM — every car with what occupies it
 * during the month (bookings, maintenance, owner blocks) and its availability
 * windows. The browser turns this into the grid.
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const { providerId, membership } = await requireProviderAccess("provider.read");
  const { month: requested } = CalendarQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  const month = requested ?? new Date().toISOString().slice(0, 7);

  const { data: units, error } = await supabaseAdmin
    .from("fleet_units")
    .select("id, branch_id, vehicle_id, plate, requires_window, status, listing_status")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`calendar: ${error.message}`);
  const visible = (units ?? []).filter((u) => canAccessBranch(membership, u.branch_id));
  if (visible.length === 0) return NextResponse.json({ month, units: [] });

  const unitIds = visible.map((u) => u.id);
  const [branches, vehicles] = await Promise.all([
    supabaseAdmin.from("branches").select("id, timezone").eq("provider_id", providerId),
    supabaseAdmin.from("vehicles").select("id, name").in("id", [...new Set(visible.map((u) => u.vehicle_id))]),
  ]);
  const zones = new Map((branches.data ?? []).map((b) => [b.id, b.timezone]));
  const names = new Map((vehicles.data ?? []).map((v) => [v.id, v.name]));

  // Fetch a day either side of the month so the buffer and time-zone offsets never clip an edge day.
  const days = monthDays(month);
  const from = startOfDayInZone(days[0]!, "UTC").getTime() - 86_400_000;
  const to = startOfDayInZone(nextDay(days[days.length - 1]!), "UTC").getTime() + 86_400_000;
  const overlap = `[${new Date(from).toISOString()},${new Date(to).toISOString()})`;

  const [occupancy, windows] = await Promise.all([
    supabaseAdmin.from("unit_occupancy").select("id, fleet_unit_id, reason, booking_id, during").in("fleet_unit_id", unitIds).overlaps("during", overlap),
    supabaseAdmin.from("availability_windows").select("id, fleet_unit_id, during").in("fleet_unit_id", unitIds).overlaps("during", overlap),
  ]);
  if (occupancy.error) throw new Error(`calendar: ${occupancy.error.message}`);
  if (windows.error) throw new Error(`calendar: ${windows.error.message}`);

  const bookingIds = (occupancy.data ?? []).map((o) => o.booking_id).filter((id): id is string => Boolean(id));
  const { data: bookings } = bookingIds.length
    ? await supabaseAdmin.from("bookings").select("id, reference").in("id", bookingIds)
    : { data: [] };
  const references = new Map((bookings ?? []).map((b) => [b.id, b.reference]));

  return NextResponse.json({
    month,
    units: visible.map((u) => ({
      id: u.id,
      plate: u.plate,
      vehicle_name: names.get(u.vehicle_id) ?? "Unknown model",
      requires_window: u.requires_window,
      status: u.status,
      listing_status: u.listing_status,
      timezone: zones.get(u.branch_id) ?? "UTC",
      occupancy: (occupancy.data ?? [])
        .filter((o) => o.fleet_unit_id === u.id)
        .map((o) => ({ id: o.id, reason: o.reason, reference: o.booking_id ? (references.get(o.booking_id) ?? null) : null, ...parseRange(o.during) })),
      windows: (windows.data ?? [])
        .filter((w) => w.fleet_unit_id === u.id)
        .map((w) => ({ id: w.id, ...parseRange(w.during) })),
    })),
  });
});
