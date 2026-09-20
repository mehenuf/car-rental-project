import { createHash } from "node:crypto";
import { simulateConfirm, simulateOutcome } from "@/lib/payments/simulate";
import type {
  ChargeRequest,
  PaymentProvider,
  ProviderResult,
  RefundRequest,
  RefundResult,
} from "@/lib/payments/provider";

function refFor(prefix: string, key: string): string {
  return `${prefix}${createHash("sha1").update(key).digest("hex").slice(0, 16)}`;
}

/**
 * A deterministic stand-in for a real processor. It keeps no state of its own
 * (the payments table is the state): references derive from the idempotency
 * key, so repeating a request returns the same answer, exactly as a real
 * provider must.
 */
export class SimulatedProvider implements PaymentProvider {
  readonly name = "simulated" as const;

  async createCharge(request: ChargeRequest): Promise<ProviderResult> {
    const providerRef = refFor("sim_", request.idempotencyKey);
    const outcome = simulateOutcome(request.method, request.testInput);
    return outcome.status === "failed"
      ? { providerRef, status: "failed", failureCode: outcome.failureCode }
      : { providerRef, status: outcome.status };
  }

  async confirmCharge(providerRef: string, input: { code: string | null }): Promise<ProviderResult> {
    const outcome = simulateConfirm(input.code);
    return outcome.status === "failed"
      ? { providerRef, status: "failed", failureCode: outcome.failureCode }
      : { providerRef, status: "succeeded" };
  }

  /** Always authorizes, unless a tester types "nodeposit" to exercise the failure path. */
  async authorizeDeposit(request: ChargeRequest): Promise<ProviderResult> {
    const providerRef = refFor("sim_dep_", request.idempotencyKey);
    return (request.testInput ?? "").trim().toLowerCase() === "nodeposit"
      ? { providerRef, status: "failed", failureCode: "deposit_declined" }
      : { providerRef, status: "succeeded" };
  }

  /** Nothing to release: a simulated authorization holds no real funds. */
  async releaseDeposit(providerRef: string): Promise<void> {
    void providerRef;
  }

  /** The capture is recorded in our ledger by record/capture_deposit; there is no processor to call. */
  async captureDeposit(providerRef: string, amountMinor: number): Promise<void> {
    void providerRef;
    void amountMinor;
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    return { providerRef: refFor("sim_re_", request.idempotencyKey), status: "succeeded" };
  }
}
