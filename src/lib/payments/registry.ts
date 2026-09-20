import "server-only";
import { methodsFor, type PaymentMethodCode, type PaymentMethodInfo } from "@/lib/payments/methods";
import type { PaymentProvider } from "@/lib/payments/provider";
import { SimulatedProvider } from "@/lib/payments/simulated-provider";
import { StripeProvider } from "@/lib/payments/stripe-provider";

/** Methods Stripe's own payment form handles when Stripe is configured. */
const STRIPE_METHODS: readonly PaymentMethodCode[] = ["card", "apple_pay", "google_pay"];

const simulated = new SimulatedProvider();
let stripeProvider: StripeProvider | null = null;

export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function stripe(): StripeProvider {
  stripeProvider ??= new StripeProvider(process.env.STRIPE_SECRET_KEY!);
  return stripeProvider;
}

/** Card and wallet charges go to Stripe when it is configured; everything else is simulated. */
export function chargeProviderFor(method: PaymentMethodCode): PaymentProvider {
  return stripeEnabled() && STRIPE_METHODS.includes(method) ? stripe() : simulated;
}

export function depositProvider(): PaymentProvider {
  return simulated;
}

export function providerByName(name: "stripe" | "simulated"): PaymentProvider {
  return name === "stripe" ? stripe() : simulated;
}

/** What the checkout page offers: with Stripe on, wallets live inside Stripe's form, so they are not listed separately. */
export function checkoutMethods(country: string, currency: string): PaymentMethodInfo[] {
  const all = methodsFor(country, currency);
  return stripeEnabled() ? all.filter((m) => m.code !== "apple_pay" && m.code !== "google_pay") : all;
}
