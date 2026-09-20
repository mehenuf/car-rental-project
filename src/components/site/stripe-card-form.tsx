"use client";

import { useMemo, useState, type FormEvent } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";

function StripeInner({
  returnUrl,
  payLabel,
  onDone,
  onError,
}: {
  returnUrl: string;
  payLabel: string;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    // Stripe confirms the card in the browser; the webhook then confirms the booking on our side.
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });
    setBusy(false);
    if (error) onError(error.message ?? "Your payment could not be completed.");
    else onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-(--space-sm)">
      <PaymentElement />
      <Button type="submit" size="lg" disabled={!stripe || busy}>
        {busy ? "Processing..." : payLabel}
      </Button>
    </form>
  );
}

/** Stripe's hosted payment form (test mode). Card data goes straight to Stripe, never to our servers. */
export function StripeCardForm({
  clientSecret,
  publishableKey,
  returnUrl,
  payLabel,
  onDone,
  onError,
}: {
  clientSecret: string;
  publishableKey: string;
  returnUrl: string;
  payLabel: string;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <StripeInner returnUrl={returnUrl} payLabel={payLabel} onDone={onDone} onError={onError} />
    </Elements>
  );
}
