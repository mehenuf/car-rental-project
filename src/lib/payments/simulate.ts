import type { PaymentMethodCode } from "@/lib/payments/methods";

export type SimulatedOutcome =
  | { status: "succeeded" }
  | { status: "requires_action" }
  | { status: "failed"; failureCode: string };

/** The code a tester enters to complete a payment that asks for extra authentication. */
export const SIMULATED_ACTION_CODE = "000000";

/**
 * The deterministic behaviour of the simulated provider, modelled on Stripe's
 * test cards. Cards are decided by their last four digits; every other method
 * by the keywords "decline" and "pending". Anything else succeeds.
 */
export function simulateOutcome(method: PaymentMethodCode, testInput: string | null): SimulatedOutcome {
  const input = (testInput ?? "").trim().toLowerCase();

  if (method === "card") {
    const last4 = input.replace(/\D/g, "").slice(-4);
    switch (last4) {
      case "0002":
        return { status: "failed", failureCode: "card_declined" };
      case "9995":
        return { status: "failed", failureCode: "insufficient_funds" };
      case "0069":
        return { status: "failed", failureCode: "expired_card" };
      case "3220":
        return { status: "requires_action" };
      default:
        return { status: "succeeded" };
    }
  }

  if (input === "decline") return { status: "failed", failureCode: "declined_by_provider" };
  if (input === "pending") return { status: "requires_action" };
  return { status: "succeeded" };
}

export function simulateConfirm(code: string | null): SimulatedOutcome {
  return code === SIMULATED_ACTION_CODE
    ? { status: "succeeded" }
    : { status: "failed", failureCode: "authentication_failed" };
}
