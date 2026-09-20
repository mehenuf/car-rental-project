import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { RateLimitError } from "@/lib/errors";
import { resolveRequestIdentity } from "@/lib/guest";
import { paymentsDeps } from "@/lib/payments/deps";
import { startCheckout } from "@/lib/payments/service";
import { createRateLimiter, getVisitorId } from "@/lib/rate-limit";
import { StartPaymentSchema } from "@/lib/schemas";

// Public and state-changing (it charges), so rate-limited like bookings.
const isRateLimited = createRateLimiter({ limit: 10, windowMs: 60_000 });

/**
 * POST /api/payments/intents — pays for the caller's pending booking.
 * The caller must own the booking (signed-in user or the guest cookie that
 * created it). Repeating the same `attempt` replays the stored result.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  if (isRateLimited(getVisitorId(request))) throw new RateLimitError();

  const input = StartPaymentSchema.parse(await request.json());
  const identity = await resolveRequestIdentity();

  const result = await startCheckout(paymentsDeps(), {
    reference: input.reference,
    method: input.method,
    testInput: input.test_input ?? null,
    attempt: input.attempt,
    identity: { userId: identity.userId, guestId: identity.guestId },
  });

  return NextResponse.json({
    payment_id: result.paymentId,
    status: result.status,
    failure_code: result.failureCode ?? null,
    client_secret: result.clientSecret ?? null,
  });
});
