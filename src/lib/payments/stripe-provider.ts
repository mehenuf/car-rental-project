import Stripe from "stripe";
import type {
  ChargeRequest,
  PaymentProvider,
  ProviderResult,
  RefundRequest,
  RefundResult,
} from "@/lib/payments/provider";
import { SimulatedProvider } from "@/lib/payments/simulated-provider";

/**
 * Stripe in test mode for card and wallet payments and refunds. The browser
 * confirms the PaymentIntent with Stripe Elements and the final result
 * arrives through the webhook. Security deposits are always simulated: a
 * real hold needs a saved payment method and Connect-level flows that are
 * out of scope for this showcase.
 */
export class StripeProvider implements PaymentProvider {
  readonly name = "stripe" as const;
  private readonly stripe: Stripe;
  private readonly deposits = new SimulatedProvider();

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey);
  }

  async createCharge(request: ChargeRequest): Promise<ProviderResult> {
    const intent = await this.stripe.paymentIntents.create(
      {
        amount: request.amountMinor,
        currency: request.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        receipt_email: request.customerEmail,
        description: request.description,
        metadata: { payment_id: request.paymentId },
      },
      { idempotencyKey: request.idempotencyKey }
    );

    if (intent.status === "succeeded") return { providerRef: intent.id, status: "succeeded" };
    if (intent.status === "processing") return { providerRef: intent.id, status: "processing" };
    return {
      providerRef: intent.id,
      status: "requires_action",
      clientSecret: intent.client_secret ?? undefined,
    };
  }

  async confirmCharge(): Promise<ProviderResult> {
    throw new Error("Stripe payments are confirmed in the browser and finalised by the webhook.");
  }

  authorizeDeposit(request: ChargeRequest): Promise<ProviderResult> {
    return this.deposits.authorizeDeposit(request);
  }

  releaseDeposit(providerRef: string): Promise<void> {
    return this.deposits.releaseDeposit(providerRef);
  }

  captureDeposit(providerRef: string, amountMinor: number): Promise<void> {
    return this.deposits.captureDeposit(providerRef, amountMinor);
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    try {
      const refund = await this.stripe.refunds.create(
        { payment_intent: request.providerRef, amount: request.amountMinor },
        { idempotencyKey: request.idempotencyKey }
      );
      return refund.status === "failed" || refund.status === "canceled"
        ? { providerRef: refund.id, status: "failed", failureCode: refund.failure_reason ?? "refund_failed" }
        : { providerRef: refund.id, status: "succeeded" };
    } catch (err) {
      return { providerRef: "", status: "failed", failureCode: err instanceof Error ? err.message : "refund_failed" };
    }
  }
}
