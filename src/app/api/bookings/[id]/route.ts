import { NextRequest, NextResponse } from "next/server";
import { updateBookingStatus } from "@/lib/queries";
import { withErrorHandling } from "@/lib/api-response";
import { BookingIdParamSchema, UpdateBookingStatusSchema } from "@/lib/schemas";

/**
 * PATCH /api/bookings/[id] — admin-only status change. Unlike POST
 * /api/bookings, this is allowed to set status directly.
 */
export const PATCH = withErrorHandling(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const { id } = BookingIdParamSchema.parse(await context.params);
    const body = await request.json();
    const { status } = UpdateBookingStatusSchema.parse(body);
    const booking = await updateBookingStatus(id, status);
    return NextResponse.json(booking);
  }
);
