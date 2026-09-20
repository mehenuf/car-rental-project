import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { RateLimitError } from "@/lib/errors";
import { getSignedQuote } from "@/lib/pricing/service";
import { createRateLimiter, getVisitorId } from "@/lib/rate-limit";
import { QuoteRequestSchema } from "@/lib/schemas";

// Public and unauthenticated, and each call reads several tables, so it is
// rate-limited (more generously than bookings, since the booking panel
// re-quotes when the customer changes dates or options).
const isRateLimited = createRateLimiter({ limit: 30, windowMs: 60_000 });

/**
 * POST /api/quote — prices a trip (all-inclusive total, itemised lines,
 * deposit) and returns a token that stays valid for 15 minutes. Answers 409
 * if no unit is free for the dates, so an unbookable trip is never quoted.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  if (isRateLimited(getVisitorId(request))) throw new RateLimitError();

  const input = QuoteRequestSchema.parse(await request.json());
  const signed = await getSignedQuote({
    vehicleId: input.vehicle_id,
    pickupBranchId: input.pickup_branch_id ?? null,
    dropoffBranchId: input.dropoff_branch_id ?? null,
    pickupAt: input.pickup_at,
    dropoffAt: input.dropoff_at,
    extras: input.extras,
    promoCode: input.promo_code ?? null,
    driverAge: input.driver_age ?? null,
  });

  return NextResponse.json({
    quote: signed.quote,
    token: signed.token,
    expires_at: signed.expiresAt.toISOString(),
    available_extras: signed.availableExtras,
  });
});
