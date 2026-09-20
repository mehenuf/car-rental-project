import { describe, expect, it } from "vitest";
import Stripe from "stripe";
import { SimulatedProvider } from "@/lib/payments/simulated-provider";
import { parseStripeWebhook } from "@/lib/payments/stripe-webhook";
import type { ChargeRequest } from "@/lib/payments/provider";

const base: ChargeRequest = {
  paymentId: "pay-1",
  amountMinor: 15000,
  currency: "USD",
  method: "card",
  idempotencyKey: "charge:b1:card:1",
  description: "Booking BC-123",
  customerEmail: "a@example.com",
  testInput: null,
};

describe("SimulatedProvider", () => {
  const provider = new SimulatedProvider();

  it("succeeds by default and derives a stable reference from the idempotency key", async () => {
    const a = await provider.createCharge(base);
    const b = await provider.createCharge(base);
    expect(a.status).toBe("succeeded");
    expect(a.providerRef).toMatch(/^sim_/);
    expect(a.providerRef).toBe(b.providerRef);
    const other = await provider.createCharge({ ...base, idempotencyKey: "charge:b2:card:1" });
    expect(other.providerRef).not.toBe(a.providerRef);
  });

  it("declines, needs action or fails according to the test input", async () => {
    expect(await provider.createCharge({ ...base, testInput: "4000000000000002" })).toMatchObject({
      status: "failed",
      failureCode: "card_declined",
    });
    expect(await provider.createCharge({ ...base, testInput: "4000000000003220" })).toMatchObject({ status: "requires_action" });
    expect(await provider.createCharge({ ...base, method: "mpesa", testInput: "decline" })).toMatchObject({
      status: "failed",
      failureCode: "declined_by_provider",
    });
  });

  it("completes an action-required payment only with the right code", async () => {
    expect(await provider.confirmCharge("sim_x", { code: "000000" })).toMatchObject({ status: "succeeded" });
    expect(await provider.confirmCharge("sim_x", { code: "1" })).toMatchObject({ status: "failed", failureCode: "authentication_failed" });
  });

  it("authorizes deposits unless asked to fail, and refunds", async () => {
    expect(await provider.authorizeDeposit(base)).toMatchObject({ status: "succeeded" });
    expect(await provider.authorizeDeposit({ ...base, testInput: "nodeposit" })).toMatchObject({
      status: "failed",
      failureCode: "deposit_declined",
    });
    await expect(provider.releaseDeposit("sim_x")).resolves.toBeUndefined();
    await expect(provider.captureDeposit("sim_x", 100)).resolves.toBeUndefined();
    const refund = await provider.refund({ providerRef: "sim_x", amountMinor: 500, currency: "USD", idempotencyKey: "refund:1" });
    expect(refund.status).toBe("succeeded");
    expect(refund.providerRef).toMatch(/^sim_re_/);
  });
});

describe("parseStripeWebhook", () => {
  const secret = "whsec_test_secret";
  const stripe = new Stripe("sk_test_dummy");

  function signed(event: unknown) {
    const payload = JSON.stringify(event);
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    return { payload, header };
  }

  it("maps a succeeded payment intent", () => {
    const { payload, header } = signed({
      id: "evt_1",
      object: "event",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_123", object: "payment_intent", status: "succeeded", metadata: { payment_id: "pay-1" } } },
    });
    expect(parseStripeWebhook(payload, header, secret)).toEqual({
      kind: "charge_succeeded",
      providerRef: "pi_123",
      paymentId: "pay-1",
    });
  });

  it("maps a failed payment intent with its failure code", () => {
    const { payload, header } = signed({
      id: "evt_2",
      object: "event",
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_456",
          object: "payment_intent",
          metadata: { payment_id: "pay-2" },
          last_payment_error: { code: "card_declined" },
        },
      },
    });
    expect(parseStripeWebhook(payload, header, secret)).toEqual({
      kind: "charge_failed",
      providerRef: "pi_456",
      paymentId: "pay-2",
      failureCode: "card_declined",
    });
  });

  it("ignores other event types", () => {
    const { payload, header } = signed({ id: "evt_3", object: "event", type: "customer.created", data: { object: { id: "cus_1" } } });
    expect(parseStripeWebhook(payload, header, secret)).toEqual({ kind: "ignored" });
  });

  it("rejects a bad signature", () => {
    const { payload } = signed({ id: "evt_4", object: "event", type: "payment_intent.succeeded", data: { object: { id: "pi_1" } } });
    expect(() => parseStripeWebhook(payload, "t=1,v1=deadbeef", secret)).toThrow(/signature/i);
  });
});
