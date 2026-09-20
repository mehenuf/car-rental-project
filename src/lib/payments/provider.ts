import type { PaymentMethodCode } from "@/lib/payments/methods";

export interface ChargeRequest {
  paymentId: string;
  amountMinor: number;
  currency: string;
  method: PaymentMethodCode;
  /** Unique per intended action; the provider must return the same result for a repeated key. */
  idempotencyKey: string;
  description: string;
  customerEmail: string;
  /** What a tester typed into the simulated form (card number or keyword). Never a real card number. */
  testInput: string | null;
}

export interface ProviderResult {
  providerRef: string;
  status: "succeeded" | "requires_action" | "processing" | "failed";
  failureCode?: string;
  /** Stripe only: lets the browser confirm the payment with Stripe Elements. */
  clientSecret?: string;
}

export interface RefundRequest {
  providerRef: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
}

export interface RefundResult {
  providerRef: string;
  status: "succeeded" | "failed";
  failureCode?: string;
}

/**
 * What the platform needs from a payment processor. The rest of the code
 * depends only on this interface, so a real processor can replace the
 * simulated one without touching callers.
 */
export interface PaymentProvider {
  readonly name: "stripe" | "simulated";
  createCharge(request: ChargeRequest): Promise<ProviderResult>;
  /** Completes a payment that returned `requires_action` (simulated only; Stripe is confirmed in the browser). */
  confirmCharge(providerRef: string, input: { code: string | null }): Promise<ProviderResult>;
  authorizeDeposit(request: ChargeRequest): Promise<ProviderResult>;
  releaseDeposit(providerRef: string): Promise<void>;
  captureDeposit(providerRef: string, amountMinor: number): Promise<void>;
  refund(request: RefundRequest): Promise<RefundResult>;
}
