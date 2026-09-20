import { NextRequest, NextResponse } from "next/server";
import { dispatchSoon } from "@/lib/comms/service";
import { withErrorHandling } from "@/lib/api-response";
import { NotFoundError } from "@/lib/errors";
import { resolveRequestIdentity } from "@/lib/guest";
import { paymentsDeps } from "@/lib/payments/deps";
import { paymentsRepo } from "@/lib/payments/repo";
import { cancelBooking } from "@/lib/payments/service";
import { BookingIdParamSchema } from "@/lib/schemas";

/**
 * POST /api/bookings/[id]/cancel — a customer cancels their own booking.
 * The refund follows the cancellation policy frozen in the booking's price snapshot.
 */
export const POST = withErrorHandling(
  async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const { id } = BookingIdParamSchema.parse(await context.params);
    const identity = await resolveRequestIdentity();

    const booking = await paymentsRepo.getBooking(id);
    const owns =
      booking &&
      ((booking.user_id !== null && booking.user_id === identity.userId) ||
        (booking.guest_id !== null && booking.guest_id === identity.guestId));
    if (!owns) throw new NotFoundError("Booking not found.");

    const result = await cancelBooking(paymentsDeps(), { bookingId: id, cancelledBy: "customer" });
    dispatchSoon();
  return NextResponse.json({
      refund_minor: result.refundMinor,
      refund_bp: result.refundBp,
      refund_status: result.refundStatus,
    });
  }
);
