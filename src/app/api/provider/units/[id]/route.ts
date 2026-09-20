import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError, ConflictError, NotFoundError } from "@/lib/errors";
import { requireProviderAccess } from "@/lib/provider/context";
import { canAccessBranch } from "@/lib/provider/permissions";
import { IdParamSchema, UpdateUnitSchema } from "@/lib/provider/schemas";
import { supabaseAdmin } from "@/lib/supabase-server";

/** PATCH /api/provider/units/[id] — change a car's plate, VIN or status. A car with upcoming bookings cannot be taken off the road. */
export const PATCH = withErrorHandling(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const { providerId, membership } = await requireProviderAccess("fleet.write");
    const { id } = IdParamSchema.parse(await context.params);
    const patch = UpdateUnitSchema.parse(await request.json());

    const { data: unit, error } = await supabaseAdmin
      .from("fleet_units")
      .select("id, branch_id")
      .eq("id", id)
      .eq("provider_id", providerId)
      .maybeSingle();
    if (error) throw new Error(`unit: ${error.message}`);
    if (!unit) throw new NotFoundError("Car not found.");
    if (!canAccessBranch(membership, unit.branch_id)) throw new ApiError(403, "You can only manage your own branch.");

    if (patch.status === "maintenance" || patch.status === "retired") {
      const { count, error: countError } = await supabaseAdmin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("fleet_unit_id", id)
        .in("status", ["pending", "confirmed", "active"])
        .gt("dropoff_at", new Date().toISOString());
      if (countError) throw new Error(`unit: ${countError.message}`);
      if ((count ?? 0) > 0) throw new ConflictError("This car has upcoming bookings. Complete or cancel them first.");
    }

    const { data, error: updateError } = await supabaseAdmin
      .from("fleet_units")
      .update(patch)
      .eq("id", id)
      .eq("provider_id", providerId)
      .select("id, status, plate, vin")
      .single();
    if (updateError) {
      if (updateError.code === "23505") throw new ConflictError("You already have a car with this plate.");
      throw new Error(`unit: ${updateError.message}`);
    }
    return NextResponse.json(data);
  }
);
