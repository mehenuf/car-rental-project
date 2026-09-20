import "server-only";
import { paymentsRepo } from "@/lib/payments/repo";
import { chargeProviderFor, depositProvider, providerByName } from "@/lib/payments/registry";
import type { PaymentsDeps } from "@/lib/payments/service";

/** The real wiring: Supabase for state, Stripe or the simulated provider for money movement. */
export function paymentsDeps(): PaymentsDeps {
  return {
    repo: paymentsRepo,
    chargeProviderFor,
    depositProvider: depositProvider(),
    providerByName,
    now: () => new Date(),
  };
}
