import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { requireProviderAccess } from "@/lib/provider/context";
import { canAccessBranch } from "@/lib/provider/permissions";
import { ProviderBookingsQuerySchema } from "@/lib/provider/schemas";
import { supabaseAdmin } from "@/lib/supabase-server";

/** GET /api/provider/bookings?view=upcoming|active|past|all — the provider's bookings with what is needed to run them. */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const { providerId, membership } = await requireProviderAccess("bookings.read");
  const { view } = ProviderBookingsQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  const now = new Date().toISOString();

  let query = supabaseAdmin
    .from("bookings")
    .select("id, reference, status, payment_status, customer_name, email, phone, pickup_at, dropoff_at, total_amount, currency, days, fleet_unit_id, pickup_branch_id, created_at")
    .eq("provider_id", providerId)
    .limit(150);

  if (view === "upcoming") query = query.in("status", ["pending", "confirmed"]).gte("dropoff_at", now).order("pickup_at", { ascending: true });
  else if (view === "active") query = query.eq("status", "active").order("dropoff_at", { ascending: true });
  else if (view === "past") query = query.in("status", ["completed", "cancelled", "no_show"]).order("pickup_at", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(`bookings: ${error.message}`);
  const rows = (data ?? []).filter((b) => b.pickup_branch_id === null || canAccessBranch(membership, b.pickup_branch_id));

  const unitIds = [...new Set(rows.map((b) => b.fleet_unit_id).filter((id): id is string => Boolean(id)))];
  const bookingIds = rows.map((b) => b.id);
  const [units, inspections] = await Promise.all([
    unitIds.length ? supabaseAdmin.from("fleet_units").select("id, plate, vehicle_id").in("id", unitIds) : Promise.resolve({ data: [] }),
    bookingIds.length ? supabaseAdmin.from("booking_inspections").select("booking_id, kind").in("booking_id", bookingIds) : Promise.resolve({ data: [] }),
  ]);
  const vehicleIds = [...new Set((units.data ?? []).map((u) => u.vehicle_id))];
  const { data: vehicles } = vehicleIds.length ? await supabaseAdmin.from("vehicles").select("id, name").in("id", vehicleIds) : { data: [] };
  const names = new Map((vehicles ?? []).map((v) => [v.id, v.name]));
  const unitInfo = new Map((units.data ?? []).map((u) => [u.id, { plate: u.plate, name: names.get(u.vehicle_id) ?? "Unknown model" }]));

  return NextResponse.json({
    data: rows.map((b) => ({
      ...b,
      plate: b.fleet_unit_id ? (unitInfo.get(b.fleet_unit_id)?.plate ?? null) : null,
      vehicle_name: b.fleet_unit_id ? (unitInfo.get(b.fleet_unit_id)?.name ?? null) : null,
      inspections: (inspections.data ?? []).filter((i) => i.booking_id === b.id).map((i) => i.kind),
    })),
  });
});
