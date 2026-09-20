import { NextRequest, NextResponse } from "next/server";
import { updateBookingStatus } from "@/lib/queries";
import { withErrorHandling } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { paymentsDeps } from "@/lib/payments/deps";
import { paymentsRepo } from "@/lib/payments/repo";
import { cancelBooking } from "@/lib/payments/service";
import { BookingIdParamSchema, UpdateBookingStatusSchema } from "@/lib/schemas";

/**
 * PATCH /api/bookings/[id] — admin-only status change. Unlike POST
 * /api/bookings, this is allowed to set status directly.
 */
export const PATCH = withErrorHandling(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    await requireAdmin();
    const { id } = BookingIdParamSchema.parse(await context.params);
    const body = await request.json();
    const { status } = UpdateBookingStatusSchema.parse(body);

    // Cancelling goes through the payments flow so the customer is refunded and the deposit hold is released.
    if (status === "cancelled") {
      const existing = await paymentsRepo.getBooking(id);
      if (existing && existing.status !== "cancelled") {
        await cancelBooking(paymentsDeps(), { bookingId: id, cancelledBy: "admin" });
      }
    }

    const booking = await updateBookingStatus(id, status);
    return NextResponse.json(booking);
  }
);
