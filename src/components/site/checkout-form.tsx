"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@/lib/i18n/link";
import { useLocale, useLocalePath, useLocaleRouter, useT } from "@/lib/i18n/provider";
import { numberingLocale } from "@/lib/i18n/locales";
import { quoteLineLabel } from "@/lib/pricing/localize";
import type { QuoteLine } from "@/lib/pricing/types";
import { Clock, FlaskConical, ShieldCheck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StripeCardForm } from "@/components/site/stripe-card-form";
import { describePaymentFailure } from "@/lib/payments/messages";
import { formatMinor } from "@/lib/pricing/money";
import { formatDate } from "@/lib/format";
import { nextRadioValue } from "@/lib/radio-keys";
import { directionOf } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

interface CheckoutMethod {
  code: string;
  label: string;
  testHint: string;
}

interface PaymentResponse {
  payment_id: string;
  status: "succeeded" | "requires_action" | "processing" | "failed";
  failure_code: string | null;
  client_secret: string | null;
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function CheckoutForm({
  reference,
  vehicleName,
  currency,
  totalMinor,
  depositMinor,
  lines,
  days,
  holdExpiresAt,
  pickupCity,
  pickupAt,
  dropoffAt,
  methods,
  stripe,
}: {
  reference: string;
  vehicleName: string;
  currency: string;
  totalMinor: number;
  depositMinor: number;
  lines: QuoteLine[];
  days: number;
  holdExpiresAt: string | null;
  pickupCity: string | null;
  pickupAt: string;
  dropoffAt: string;
  methods: CheckoutMethod[];
  stripe: { enabled: boolean; publishableKey: string | null };
}) {
  const router = useLocaleRouter();
  const t = useT();
  const locale = useLocale();
  const [method, setMethod] = useState(methods[0]?.code ?? "card");
  const [testInput, setTestInput] = useState("");
  const [attempt, setAttempt] = useState(() => crypto.randomUUID());
  const [phase, setPhase] = useState<"form" | "code" | "stripe" | "processing">("form");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // What is read out about the hold. The visible countdown changes every second, which would be read every second; this
  // changes only when the hold starts, at 5 minutes, at 1 minute and when it ends.
  const [initialRemainingMs] = useState(() => (holdExpiresAt ? new Date(holdExpiresAt).getTime() - Date.now() : null));

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remainingMs = holdExpiresAt ? new Date(holdExpiresAt).getTime() - now : null;
  const expired = remainingMs !== null && remainingMs <= 0;
  const selected = methods.find((m) => m.code === method);
  const usesStripe = stripe.enabled && stripe.publishableKey !== null && method === "card";
  const money = (minor: number) => formatMinor(minor, currency, numberingLocale(locale));
  const payLabel = t("checkout.pay", { amount: money(totalMinor) });
  const localePath = useLocalePath();
  const confirmationPath = `/booking-confirmation?ref=${encodeURIComponent(reference)}`;
  const confirmationUrl = localePath(confirmationPath);

  function finish() {
    router.push(confirmationPath);
  }

  function handleResult(body: PaymentResponse) {
    setPaymentId(body.payment_id);
    if (body.status === "succeeded") return finish();
    if (body.status === "processing") {
      // The payment is not finished yet, so do not send the renter to a page that says "Pay now".
      setPhase("processing");
      return;
    }
    if (body.status === "requires_action") {
      if (body.client_secret) {
        setClientSecret(body.client_secret);
        setPhase("stripe");
      } else {
        setPhase("code");
      }
      return;
    }
    setError(describePaymentFailure(body.failure_code));
    setPhase("form");
    setAttempt(crypto.randomUUID()); // a new attempt id, so the retry is a fresh charge
  }

  async function call(url: string, payload: unknown) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? t("checkout.failed"));
      handleResult(body as PaymentResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("checkout.failed"));
    } finally {
      setBusy(false);
    }
  }

  function pay(e: FormEvent) {
    e.preventDefault();
    void call("/api/payments/intents", {
      reference,
      method,
      test_input: usesStripe ? null : testInput.trim() || null,
      attempt,
    });
  }

  function confirmCode(e: FormEvent) {
    e.preventDefault();
    if (paymentId) void call(`/api/payments/${paymentId}/confirm`, { code: code.trim() || null });
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-(--space-lg) px-(--space-sm) py-(--space-xl) lg:grid-cols-[1.2fr_1fr]">
      <div className="flex flex-col gap-(--space-md)">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">{t("checkout.title")}</h1>
          <p className="text-muted-foreground">
            {vehicleName} &middot; {t("checkout.ref", { reference })}
          </p>
        </div>

        {remainingMs !== null && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
              expired ? "border-destructive/40 text-destructive" : "border-border text-muted-foreground"
            )}
          >
            <Clock className="size-4" aria-hidden />
            <span aria-hidden="true">
              {expired ? t("checkout.holdExpired") : t("checkout.holding", { time: formatCountdown(remainingMs) })}
            </span>
            <span role="status" className="sr-only">
              {expired
                ? t("checkout.holdExpired")
                : remainingMs <= 60_000
                  ? t("checkout.holding", { time: "1:00" })
                  : remainingMs <= 300_000
                    ? t("checkout.holding", { time: "5:00" })
                    : t("checkout.holding", { time: formatCountdown(initialRemainingMs ?? remainingMs) })}
            </span>
          </div>
        )}

        {expired ? (
          <Link href="/cars" className={buttonVariants({ size: "lg" })}>
            {t("checkout.findAnother")}
          </Link>
        ) : phase === "processing" ? (
          <div role="status" className="flex flex-col gap-(--space-sm)">
            <p className="text-sm text-foreground">{t("checkout.processingNote")}</p>
            <Link href="/account" className={buttonVariants({ size: "lg" })}>
              {t("confirmation.viewBookings")}
            </Link>
          </div>
        ) : phase === "stripe" && clientSecret && stripe.publishableKey ? (
          <StripeCardForm
            clientSecret={clientSecret}
            publishableKey={stripe.publishableKey}
            returnUrl={typeof window === "undefined" ? confirmationUrl : `${window.location.origin}${confirmationUrl}`}
            payLabel={payLabel}
            onDone={finish}
            onError={(message) => setError(message)}
          />
        ) : phase === "code" ? (
          <form onSubmit={confirmCode} className="flex flex-col gap-(--space-sm)">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pay-code">{t("checkout.confirmCode")}</Label>
              <Input id="pay-code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} autoFocus />
              <p className="text-xs text-muted-foreground">{t("checkout.testModeHint")}</p>
            </div>
            <Button type="submit" size="lg" disabled={busy}>
              {busy ? t("checkout.confirming") : t("checkout.confirmPayment")}
            </Button>
          </form>
        ) : (
          <form onSubmit={pay} className="flex flex-col gap-(--space-sm)">
            <fieldset
              role="radiogroup"
              className="flex flex-col gap-2"
              onKeyDown={(event) => {
                const next = nextRadioValue(event.key, methods.map((m) => m.code), method, directionOf(locale) === "rtl");
                if (!next) return;
                event.preventDefault();
                setMethod(next);
                event.currentTarget.querySelector<HTMLButtonElement>(`[data-value="${next}"]`)?.focus();
              }}
            >
              <legend className="mb-1 text-sm font-medium text-foreground">{t("checkout.paymentMethod")}</legend>
              {methods.map((m) => (
                <button
                  key={m.code}
                  type="button"
                  role="radio"
                  data-value={m.code}
                  tabIndex={method === m.code ? 0 : -1}
                  aria-checked={method === m.code}
                  onClick={() => setMethod(m.code)}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2.5 text-start text-sm transition-colors",
                    method === m.code ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-foreground/30"
                  )}
                >
                  <span className="font-medium">{m.label}</span>
                  <span
                    aria-hidden
                    className={cn("size-4 rounded-full border", method === m.code ? "border-primary bg-primary" : "border-input")}
                  />
                </button>
              ))}
            </fieldset>

            {usesStripe ? (
              <p className="text-sm text-muted-foreground">{t("checkout.stripeNote")}</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pay-test">{method === "card" ? t("checkout.testCard") : t("checkout.testOutcome")}</Label>
                <Input
                  id="pay-test"
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder={method === "card" ? "4242 4242 4242 4242" : "decline or pending"}
                  autoComplete="off"
                />
                {selected && <p className="text-xs text-muted-foreground">{selected.testHint}</p>}
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FlaskConical className="size-3.5" aria-hidden /> {t("checkout.simulated")}
                </p>
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" disabled={busy}>
              {busy ? t("checkout.processing") : usesStripe ? t("checkout.continueCard") : payLabel}
            </Button>
          </form>
        )}

        {phase !== "form" && error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <Card className="h-fit shadow-card ring-0">
        <CardContent className="flex flex-col gap-(--space-sm)">
          <h2 className="font-heading text-lg font-semibold text-foreground">{t("checkout.orderSummary")}</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">{t("confirmation.pickUp")}</dt>
            <dd className="text-end font-medium text-foreground">{formatDate(pickupAt, locale)}</dd>
            <dt className="text-muted-foreground">{t("confirmation.dropOff")}</dt>
            <dd className="text-end font-medium text-foreground">{formatDate(dropoffAt, locale)}</dd>
            {pickupCity && (
              <>
                <dt className="text-muted-foreground">{t("confirmation.pickUpAt")}</dt>
                <dd className="text-end font-medium text-foreground">{pickupCity}</dd>
              </>
            )}
          </dl>
          <ul className="flex flex-col gap-1.5 border-t border-border pt-(--space-sm) text-sm">
            {lines.map((line, i) => (
              <li key={`${line.kind}-${i}`} className="flex justify-between gap-3">
                <span className={cn("text-muted-foreground", line.included && "italic")}>{quoteLineLabel(line, days, t)}</span>
                <span className={cn("font-medium text-foreground", line.included && "text-muted-foreground")}>{money(line.amountMinor)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-border pt-(--space-sm)">
            <span className="font-heading font-semibold text-foreground">{t("checkout.total")}</span>
            <span className="font-heading text-xl font-bold text-accent-text">{money(totalMinor)}</span>
          </div>
          {depositMinor > 0 && (
            <p className="flex gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t("checkout.depositNote", { amount: money(depositMinor) })}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
