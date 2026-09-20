import { NextRequest, NextResponse } from "next/server";
import { dispatchSoon } from "@/lib/comms/service";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError } from "@/lib/errors";
import { paymentsDeps } from "@/lib/payments/deps";
import { handleStripeEvent } from "@/lib/payments/service";
import { parseStripeWebhook } from "@/lib/payments/stripe-webhook";

/**
 * POST /api/webhooks/stripe — Stripe's server-to-server notifications.
 * Authenticated by the signature over the raw body, not by a session.
 * Answers 200 for events we do not act on so Stripe stops retrying them.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new ApiError(503, "Stripe webhooks are not configured.");

  const signature = request.headers.get("stripe-signature");
  if (!signature) throw new ApiError(400, "Missing Stripe signature.");

  const rawBody = await request.text();
  const event = parseStripeWebhook(rawBody, signature, secret);
  const outcome = await handleStripeEvent(paymentsDeps(), event);
  dispatchSoon();
  return NextResponse.json({ received: true, outcome });
});
