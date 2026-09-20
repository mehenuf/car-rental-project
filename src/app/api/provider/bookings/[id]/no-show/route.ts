import { NextRequest, NextResponse } from "next/server";
import { dispatchSoon } from "@/lib/comms/service";
import { withErrorHandling } from "@/lib/api-response";
import { ConflictError } from "@/lib/errors";
import { requireProviderAccess } from "@/lib/provider/context";
import { loadProviderBooking } from "@/lib/provider/bookings";
import { IdParamSchema } from "@/lib/provider/schemas";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * POST /api/provider/bookings/[id]/no-show — the customer never collected the
 * car. Only possible for a confirmed booking whose pick-up time has passed. The
 * car is freed and the customer is not refunded.
 */
export const POST = withErrorHandling(
  async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const { providerId, membership } = await requireProviderAccess("bookings.operate");
    const { id } = IdParamSchema.parse(await context.params);
    const booking = await loadProviderBooking(providerId, membership, id);

    if (booking.status !== "confirmed") throw new ConflictError("Only a confirmed booking can be marked as a no-show.");
    if (new Date(booking.pickup_at) > new Date()) throw new ConflictError("The pick-up time has not passed yet.");

    const { error } = await supabaseAdmin.rpc("transition_booking", { p_booking_id: id, p_to: "no_show" });
    if (error) throw new Error(`no-show: ${error.message}`);
    dispatchSoon();
    return NextResponse.json({ status: "no_show" });
  }
);
