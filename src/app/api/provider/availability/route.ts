import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError, ConflictError, NotFoundError } from "@/lib/errors";
import { requireProviderAccess } from "@/lib/provider/context";
import { nextDay, startOfDayInZone } from "@/lib/provider/calendar";
import { canAccessBranch } from "@/lib/provider/permissions";
import { AvailabilitySchema } from "@/lib/provider/schemas";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * POST /api/provider/availability — adds either an availability window (the
 * days a private owner's car may be booked) or a block (maintenance or a day the
 * owner needs the car). Days are in the branch's time zone. The database
 * refuses overlaps, so a block cannot cover an existing booking.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const { providerId, membership } = await requireProviderAccess("availability.write");
  const input = AvailabilitySchema.parse(await request.json());

  const { data: unit, error } = await supabaseAdmin
    .from("fleet_units")
    .select("id, branch_id")
    .eq("id", input.fleet_unit_id)
    .eq("provider_id", providerId)
    .maybeSingle();
  if (error) throw new Error(`availability: ${error.message}`);
  if (!unit) throw new NotFoundError("Car not found.");
  if (!canAccessBranch(membership, unit.branch_id)) throw new ApiError(403, "You can only manage your own branch.");

  const { data: branch } = await supabaseAdmin.from("branches").select("timezone").eq("id", unit.branch_id).single();
  const timezone = branch?.timezone ?? "UTC";
  const during = `[${startOfDayInZone(input.start_date, timezone).toISOString()},${startOfDayInZone(nextDay(input.end_date), timezone).toISOString()})`;

  if (input.kind === "window") {
    const { data, error: insertError } = await supabaseAdmin
      .from("availability_windows")
      .insert({ fleet_unit_id: unit.id, provider_id: providerId, during })
      .select("id")
      .single();
    if (insertError) {
      if (insertError.code === "23P01") throw new ConflictError("This overlaps an availability window you already set.");
      throw new Error(`availability: ${insertError.message}`);
    }
    return NextResponse.json({ id: data.id }, { status: 201 });
  }

  const { data, error: insertError } = await supabaseAdmin
    .from("unit_occupancy")
    .insert({ fleet_unit_id: unit.id, provider_id: providerId, reason: input.block_reason!, during })
    .select("id")
    .single();
  if (insertError) {
    if (insertError.code === "23P01") throw new ConflictError("The car is already booked or blocked on some of these days.");
    throw new Error(`availability: ${insertError.message}`);
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
});
