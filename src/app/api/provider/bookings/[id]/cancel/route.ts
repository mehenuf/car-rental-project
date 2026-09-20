import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { requireProviderAccess } from "@/lib/provider/context";
import { loadProviderBooking } from "@/lib/provider/bookings";
import { IdParamSchema } from "@/lib/provider/schemas";
import { paymentsDeps } from "@/lib/payments/deps";
import { cancelBooking } from "@/lib/payments/service";

/**
 * POST /api/provider/bookings/[id]/cancel — the provider cancels a booking.
 * Because it is not the customer's choice, the customer is refunded in full.
 */
export const POST = withErrorHandling(
  async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const { providerId, membership } = await requireProviderAccess("bookings.cancel");
    const { id } = IdParamSchema.parse(await context.params);
    await loadProviderBooking(providerId, membership, id);

    const result = await cancelBooking(paymentsDeps(), { bookingId: id, cancelledBy: "provider" });
    return NextResponse.json({ refund_minor: result.refundMinor, refund_status: result.refundStatus });
  }
);
