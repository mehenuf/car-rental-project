import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError, ConflictError } from "@/lib/errors";
import { requireProviderAccess } from "@/lib/provider/context";
import { loadProviderBooking } from "@/lib/provider/bookings";
import { IdParamSchema, InspectionSchema } from "@/lib/provider/schemas";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * POST /api/provider/bookings/[id]/inspection — records the pickup or return
 * check. A pickup inspection hands the car over (booking becomes active); a
 * return inspection completes the booking, updates the car's mileage and
 * schedules the payout. The order and the odometer are enforced by the database.
 */
export const POST = withErrorHandling(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const { providerId, membership, userId } = await requireProviderAccess("bookings.operate");
    const { id } = IdParamSchema.parse(await context.params);
    const input = InspectionSchema.parse(await request.json());

    await loadProviderBooking(providerId, membership, id);

    // Photos must be files uploaded for this booking, never someone else's path.
    const prefix = `${providerId}/${id}/`;
    if (input.photo_paths.some((p) => !p.startsWith(prefix) || p.includes(".."))) {
      throw new ApiError(400, "One of the photos does not belong to this booking.");
    }

    const { data, error } = await supabaseAdmin.rpc("record_inspection", {
      p_booking_id: id,
      p_kind: input.kind,
      p_odometer_km: input.odometer_km,
      p_fuel_level: input.fuel_level,
      p_notes: input.notes ?? null,
      p_photo_paths: input.photo_paths,
      p_user_id: userId,
      p_override_reason: input.kind === "pickup" ? (input.licence_override_reason ?? null) : null,
    });
    if (error) {
      if (error.code === "BP006") throw new ConflictError(input.kind === "pickup" ? "Only a confirmed booking can be handed over." : "Only a booking that is out on rental can be returned.");
      if (error.code === "BP008") throw new ConflictError("The renter has no verified driver's licence. Ask them to add one to their account, or record an override reason if you checked the licence in person.");
      if (error.code === "BP009") throw new ConflictError("The renter's licence expires before the rental ends.");
      if (error.code === "BP010") throw new ConflictError("The renter is under your minimum driver age.");
      if (error.code === "BP007") throw new ConflictError("The return odometer cannot be lower than at pick-up.");
      if (error.code === "23505") throw new ConflictError("This inspection was already recorded.");
      throw new Error(`inspection: ${error.message}`);
    }
    return NextResponse.json({ status: data.status });
  }
);
