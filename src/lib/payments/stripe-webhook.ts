import Stripe from "stripe";
import { ApiError } from "@/lib/errors";

export type StripeWebhookResult =
  | { kind: "charge_succeeded"; providerRef: string; paymentId: string | null }
  | { kind: "charge_failed"; providerRef: string; paymentId: string | null; failureCode: string }
  | { kind: "ignored" };

/**
 * Verifies a Stripe webhook's signature against the raw request body and maps
 * the events we care about. Verification needs no API key, only the endpoint
 * secret. Anything else is ignored so Stripe stops retrying it.
 */
export function parseStripeWebhook(rawBody: string, signatureHeader: string, endpointSecret: string): StripeWebhookResult {
  let event: Stripe.Event;
  try {
    event = new Stripe("sk_unused").webhooks.constructEvent(rawBody, signatureHeader, endpointSecret);
  } catch {
    throw new ApiError(400, "Invalid Stripe signature.");
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    return { kind: "charge_succeeded", providerRef: intent.id, paymentId: intent.metadata?.payment_id ?? null };
  }
  if (event.type === "payment_intent.payment_failed") {
    const intent = event.data.object as Stripe.PaymentIntent;
    return {
      kind: "charge_failed",
      providerRef: intent.id,
      paymentId: intent.metadata?.payment_id ?? null,
      failureCode: intent.last_payment_error?.code ?? "payment_failed",
    };
  }
  return { kind: "ignored" };
}
