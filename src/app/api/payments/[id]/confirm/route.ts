import { NextRequest, NextResponse } from "next/server";
import { dispatchSoon } from "@/lib/comms/service";
import { withErrorHandling } from "@/lib/api-response";
import { RateLimitError } from "@/lib/errors";
import { resolveRequestIdentity } from "@/lib/guest";
import { paymentsDeps } from "@/lib/payments/deps";
import { confirmCheckout } from "@/lib/payments/service";
import { createRateLimiter, getVisitorId } from "@/lib/rate-limit";
import { ConfirmPaymentSchema, PaymentIdParamSchema } from "@/lib/schemas";

const isRateLimited = createRateLimiter({ limit: 10, windowMs: 60_000 });

/** POST /api/payments/[id]/confirm — completes a simulated payment that asked for an authentication code. */
export const POST = withErrorHandling(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    if (isRateLimited(getVisitorId(request))) throw new RateLimitError();

    const { id } = PaymentIdParamSchema.parse(await context.params);
    const { code } = ConfirmPaymentSchema.parse(await request.json());
    const identity = await resolveRequestIdentity();

    const result = await confirmCheckout(paymentsDeps(), {
      paymentId: id,
      code: code ?? null,
      identity: { userId: identity.userId, guestId: identity.guestId },
    });

    dispatchSoon();
  return NextResponse.json({
      payment_id: result.paymentId,
      status: result.status,
      failure_code: result.failureCode ?? null,
    });
  }
);
