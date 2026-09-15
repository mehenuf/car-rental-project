import { NextRequest, NextResponse } from "next/server";
import { createBooking, getRecentTransactions } from "@/lib/queries";
import { withErrorHandling } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { resolveRequestIdentity } from "@/lib/guest";
import { BookingsQuerySchema, CreateBookingSchema, searchParamsToObject } from "@/lib/schemas";
import { notifyBookingWebhook } from "@/lib/webhook";

/** GET /api/bookings?status=&sortBy=&sortOrder=&page=&pageSize= — admin-only, lists all customer bookings. */
export const GET = withErrorHandling(async (request: NextRequest) => {
  await requireAdmin();
  const query = BookingsQuerySchema.parse(
    searchParamsToObject(request.nextUrl.searchParams)
  );
  const result = await getRecentTransactions(query);
  return NextResponse.json(result);
});

/** POST /api/bookings — attaches the caller's identity (signed-in user, or a
 * guest cookie minted on first booking) so the confirmation page and
 * /dashboard can look this booking back up later without a login. */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const body = await request.json();
  const input = CreateBookingSchema.parse(body);
  const identity = await resolveRequestIdentity();

  const booking = await createBooking({
    vehicle_id: input.vehicle_id,
    customer_name: input.customer_name,
    email: input.email,
    phone: input.phone ?? null,
    pickup_location_id: input.pickup_location_id ?? null,
    dropoff_location_id: input.dropoff_location_id ?? null,
    guest_id: identity.guestId,
    user_id: identity.userId,
    pickup_at: input.pickup_at.toISOString(),
    dropoff_at: input.dropoff_at.toISOString(),
    payment_method: input.payment_method ?? null,
    source: input.source,
  });

  notifyBookingWebhook(booking);

  return NextResponse.json(booking, { status: 201 });
});
