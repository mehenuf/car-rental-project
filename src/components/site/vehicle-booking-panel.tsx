"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocale, useLocaleRouter, useT } from "@/lib/i18n/provider";
import { numberingLocale } from "@/lib/i18n/locales";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePickerField } from "@/components/site/date-picker-field";
import { TimeSelectField } from "@/components/site/time-select-field";
import { DEFAULT_TIME, combineDateAndTime, defaultTrip, parseTime } from "@/lib/booking-time";
import { QuoteBreakdown } from "@/components/site/quote-breakdown";
import { useQuote, type QuoteParams } from "@/hooks/use-quote";
import { CreateBookingSchema } from "@/lib/schemas";
import { formatCurrency } from "@/lib/format";
import { formatMinor } from "@/lib/pricing/money";
import type { VehiclePlace } from "@/lib/vehicle-place";
import type { Tables } from "@/types/database";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDateParam(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  // "2027-03-10" means that calendar day for the visitor, not midnight UTC.
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const parsed = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

interface BookingResponse {
  reference: string;
  pickup_at: string;
  dropoff_at: string;
  total_amount: number;
}

interface BookingErrorResponse {
  error: { message: string; code?: string };
  quote?: { totalMinor: number; currency: string };
}

export function VehicleBookingPanel({
  vehicle,
  defaultPickupDate,
  defaultDropoffDate,
  defaultPickupTime,
  defaultDropoffTime,
  place,
  pickupBranchId,
  dropoffBranchId,
}: {
  vehicle: Tables<"vehicles">;
  /** Where the car is picked up and its daily rate there, in that branch's currency. */
  place?: VehiclePlace | null;
  defaultPickupDate?: string;
  defaultDropoffDate?: string;
  defaultPickupTime?: string;
  defaultDropoffTime?: string;
  pickupBranchId?: number;
  dropoffBranchId?: number;
}) {
  const router = useLocaleRouter();
  const t = useT();
  const locale = useLocale();
  const money = (minor: number, currency: string) => formatMinor(minor, currency, numberingLocale(locale));
  const today = startOfToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Dates from the search are used as given. Without them the first trip is filled in after the page loads, because
  // "the next free slot today" depends on the visitor's own clock and time zone, which the server cannot know.
  const [pickupDate, setPickupDate] = useState<Date | undefined>(() =>
    defaultPickupDate ? parseDateParam(defaultPickupDate, today) : undefined
  );
  const [dropoffDate, setDropoffDate] = useState<Date | undefined>(() =>
    defaultDropoffDate ? parseDateParam(defaultDropoffDate, tomorrow) : undefined
  );

  const [pickupTime, setPickupTime] = useState(() => parseTime(defaultPickupTime) ?? DEFAULT_TIME);
  const [dropoffTime, setDropoffTime] = useState(
    () => parseTime(defaultDropoffTime) ?? parseTime(defaultPickupTime) ?? DEFAULT_TIME
  );

  useEffect(() => {
    if (defaultPickupDate && defaultDropoffDate) return;
    const trip = defaultTrip();
    /* eslint-disable react-hooks/set-state-in-effect -- one-time fill from the visitor's clock (see above) */
    if (!defaultPickupDate) {
      setPickupDate(trip.pickupDate);
      if (!parseTime(defaultPickupTime)) setPickupTime(trip.pickupTime);
    }
    if (!defaultDropoffDate) {
      setDropoffDate(trip.dropoffDate);
      if (!parseTime(defaultDropoffTime)) setDropoffTime(trip.dropoffTime);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // Runs once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trip options that change the price.
  const [selectedExtras, setSelectedExtras] = useState<Record<string, number>>({});
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [driverAgeInput, setDriverAgeInput] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill contact details for a returning visitor in this browser, from
  // either their signed-in account or a prior guest booking.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/bookings/mine")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { contact: { name: string; email: string; phone: string | null } | null } | null) => {
        if (cancelled || !body?.contact) return;
        setName((current) => current || body.contact!.name);
        setEmail((current) => current || body.contact!.email);
        setPhone((current) => current || body.contact!.phone || "");
      })
      .catch(() => {
        // Pre-fill is a convenience, not a requirement — silently skip.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pickupAt = pickupDate ? combineDateAndTime(pickupDate, pickupTime) : undefined;
  const dropoffAt = dropoffDate ? combineDateAndTime(dropoffDate, dropoffTime) : undefined;
  const datesValid = Boolean(pickupAt && dropoffAt && dropoffAt > pickupAt && pickupAt > new Date());
  const soldOut = !vehicle.available || vehicle.stock <= 0;

  const driverAge = useMemo(() => {
    const n = Number(driverAgeInput);
    return driverAgeInput.trim() !== "" && Number.isInteger(n) && n >= 16 && n <= 99 ? n : null;
  }, [driverAgeInput]);
  // Typed but not usable (12, 150, 2.5): say so, and do not price the trip as if no age had been given.
  const driverAgeInvalid = driverAgeInput.trim() !== "" && driverAge === null;

  // Why the trip cannot be priced yet, in words, instead of a Book Now that is silently disabled.
  const tripProblem =
    pickupAt && dropoffAt
      ? dropoffAt <= pickupAt
        ? t("booking.dropAfterPickup")
        : pickupAt <= new Date()
          ? t("booking.pickupInPast")
          : null
      : null;

  const extrasList = useMemo(
    () =>
      Object.entries(selectedExtras)
        .filter(([, quantity]) => quantity > 0)
        .map(([code, quantity]) => ({ code, quantity })),
    [selectedExtras]
  );

  const pickupIso = pickupAt?.toISOString();
  const dropoffIso = dropoffAt?.toISOString();
  const quoteParams = useMemo<QuoteParams | null>(
    () =>
      datesValid && pickupIso && dropoffIso && !soldOut
        ? {
            vehicleId: vehicle.id,
            pickupBranchId,
            dropoffBranchId,
            pickupAt: pickupIso,
            dropoffAt: dropoffIso,
            extras: extrasList,
            promoCode: appliedPromo,
            driverAge,
          }
        : null,
    [datesValid, pickupIso, dropoffIso, soldOut, vehicle.id, pickupBranchId, dropoffBranchId, extrasList, appliedPromo, driverAge]
  );

  const { state: quoteState, stale, refresh } = useQuote(quoteParams);
  const quoteData = quoteState.data;
  const quoteReady = quoteState.status === "ready" && !stale && Boolean(quoteParams);
  const isPricing = Boolean(quoteParams) && (quoteState.status === "loading" || stale);

  function handlePickupChange(date: Date | undefined) {
    setPickupDate(date);
    if (date && dropoffDate && dropoffDate < date) {
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      setDropoffDate(next);
    }
  }

  function setExtraQuantity(code: string, quantity: number) {
    setSelectedExtras((current) => ({ ...current, [code]: quantity }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pickupAt || !dropoffAt || !quoteReady || !quoteData) return;

    const result = CreateBookingSchema.safeParse({
      vehicle_id: vehicle.id,
      customer_name: name,
      email,
      phone: phone.trim() ? phone : undefined,
      pickup_branch_id: pickupBranchId,
      dropoff_branch_id: dropoffBranchId,
      pickup_at: pickupAt,
      dropoff_at: dropoffAt,
      extras: extrasList,
      promo_code: appliedPromo ?? undefined,
      driver_age: driverAge ?? undefined,
      source: "web",
    });

    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...result.data,
          pickup_at: result.data.pickup_at.toISOString(),
          dropoff_at: result.data.dropoff_at.toISOString(),
          // Proves which price the customer saw; a changed price comes back as 409.
          quote_token: quoteData.token,
        }),
      });
      const body = (await res.json()) as BookingResponse | BookingErrorResponse;
      if (!res.ok) {
        const failure = body as BookingErrorResponse;
        if (res.status === 409) refresh(); // price changed, quote expired or dates taken: re-quote
        if (failure.error?.code === "PRICE_CHANGED" && failure.quote) {
          setSubmitError(
            t("booking.priceChanged", { amount: money(failure.quote.totalMinor, failure.quote.currency) })
          );
          return;
        }
        throw new Error(failure.error?.message ?? t("booking.createFailed"));
      }
      const booking = body as BookingResponse;
      // The booking is held for 15 minutes while the customer pays.
      router.push(`/checkout/${encodeURIComponent(booking.reference)}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t("booking.createFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  const availableExtras = quoteData?.availableExtras ?? [];
  const optionalExtras = availableExtras.filter((extra) => !extra.isMandatory);
  const mandatoryExtras = availableExtras.filter((extra) => extra.isMandatory);
  const currency = quoteData?.quote.currency;

  return (
    <Card className="shadow-card ring-0">
      <CardContent className="flex flex-col gap-(--space-sm)">
        <div className="flex items-baseline gap-1">
          <span className="text-sm text-muted-foreground">{t("booking.from")}</span>
          <span className="font-heading text-2xl font-bold text-foreground">
            {place ? money(place.dailyMinor, place.currency) : formatCurrency(vehicle.price_per_day, locale)}
          </span>
          <span className="text-sm text-muted-foreground">{t("vehicle.perDay")}</span>
        </div>
        {place && <p className="-mt-2 text-sm text-muted-foreground">{t("booking.pickupIn", { city: place.city })}</p>}

        <div className="flex flex-col gap-(--space-sm)">
          <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-(--space-xs)">
            <DatePickerField compact label={t("booking.pickUp")} value={pickupDate} onChange={handlePickupChange} minDate={today} />
            <TimeSelectField compact label={t("search.time")} value={pickupTime} onChange={setPickupTime} />
            <DatePickerField compact label={t("booking.dropOff")} value={dropoffDate} onChange={setDropoffDate} minDate={pickupDate ?? today} />
            <TimeSelectField compact label={t("search.time")} value={dropoffTime} onChange={setDropoffTime} />
          </div>
          {tripProblem && (
            <p id="trip-problem" role="alert" className="text-sm text-destructive">{tripProblem}</p>
          )}
        </div>

        {optionalExtras.length > 0 && (
          <fieldset className="flex flex-col gap-2 border-t border-border pt-(--space-sm)">
            <legend className="sr-only">{t("booking.optionalExtras")}</legend>
            <span className="text-sm font-medium text-foreground">{t("booking.extras")}</span>
            {optionalExtras.map((extra) => {
              const quantity = selectedExtras[extra.code] ?? 0;
              const unit = currency ? money(extra.unitPriceMinor, currency) : "";
              const per = extra.pricing === "per_day" ? t("vehicle.perDay") : "";
              return (
                <div key={extra.code} className="flex items-center justify-between gap-3 text-sm pointer-coarse:min-h-11">
                  {extra.maxQuantity > 1 ? (
                    <Label htmlFor={`extra-${extra.code}`} className="flex-1 font-normal">
                      {extra.name} <span className="text-muted-foreground">({unit}{per})</span>
                    </Label>
                  ) : (
                    <Label htmlFor={`extra-${extra.code}`} className="flex flex-1 items-center gap-2 font-normal pointer-coarse:min-h-11">
                      <Checkbox
                        id={`extra-${extra.code}`}
                        checked={quantity > 0}
                        onCheckedChange={(checked) => setExtraQuantity(extra.code, checked ? 1 : 0)}
                      />
                      <span>
                        {extra.name} <span className="text-muted-foreground">({unit}{per})</span>
                      </span>
                    </Label>
                  )}
                  {extra.maxQuantity > 1 && (
                    <Input
                      id={`extra-${extra.code}`}
                      type="number"
                      min={0}
                      max={extra.maxQuantity}
                      value={quantity}
                      onChange={(e) =>
                        setExtraQuantity(extra.code, Math.min(extra.maxQuantity, Math.max(0, Number(e.target.value) || 0)))
                      }
                      className="h-8 w-16"
                    />
                  )}
                </div>
              );
            })}
            {mandatoryExtras.map((extra) => (
              <p key={extra.code} className="text-xs text-muted-foreground">
                {t("booking.included", { name: extra.name })}
              </p>
            ))}
          </fieldset>
        )}

        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="b-promo" className="text-xs">
              {t("booking.promoCode")}
            </Label>
            <Input
              id="b-promo"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value)}
              placeholder={t("booking.enterCode")}
              className="h-9"
            />
          </div>
          {appliedPromo ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setAppliedPromo(null);
                setPromoInput("");
              }}
            >
              {t("booking.remove")}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!promoInput.trim()}
              onClick={() => setAppliedPromo(promoInput.trim())}
            >
              {t("booking.apply")}
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="b-age" className="text-xs">
            {t("booking.driverAge")}
          </Label>
          <Input
            id="b-age"
            type="number"
            min={16}
            max={99}
            value={driverAgeInput}
            onChange={(e) => setDriverAgeInput(e.target.value)}
            aria-invalid={driverAgeInvalid}
            aria-describedby={driverAgeInvalid ? "b-age-error" : undefined}
            className="h-9"
          />
          {driverAgeInvalid && (
            <p id="b-age-error" role="alert" className="text-sm text-destructive">{t("booking.driverAgeRange")}</p>
          )}
        </div>

        {quoteState.status === "error" && quoteParams && (
          <p role="alert" className="border-t border-border pt-(--space-sm) text-sm text-destructive">
            {quoteState.message}
          </p>
        )}

        {/* No quote is shown once the trip stops being priceable: an old total next to a disabled Book Now reads as a bug. */}
        {quoteData && quoteParams && quoteState.status !== "error" ? (
          <QuoteBreakdown quote={quoteData.quote} isUpdating={isPricing} />
        ) : quoteParams && quoteState.status !== "error" ? (
          <p className="border-t border-border pt-(--space-sm) text-sm text-muted-foreground" aria-live="polite">
            {t("booking.calculating")}
          </p>
        ) : null}

        <Button
          type="button"
          size="lg"
          disabled={soldOut || !datesValid || !quoteReady || driverAgeInvalid}
          onClick={() => setDialogOpen(true)}
          data-chat-avoid
        >
          {soldOut ? t("booking.soldOut") : t("booking.bookNow")}
        </Button>
        {soldOut && (
          <p className="text-center text-sm text-muted-foreground">
            {t("booking.unavailable")}
          </p>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("booking.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {quoteData
                ? t("booking.dialogDesc", {
                    name: vehicle.name,
                    count: quoteData.quote.days,
                    total: money(quoteData.quote.totalMinor, quoteData.quote.currency),
                  })
                : vehicle.name}
            </DialogDescription>
          </DialogHeader>
          <form className="flex flex-col gap-(--space-sm)" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-name">{t("booking.fullName")}</Label>
              <Input
                id="b-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                aria-invalid={Boolean(fieldErrors.customer_name)}
                aria-describedby={fieldErrors.customer_name ? "b-name-error" : undefined}
              />
              {fieldErrors.customer_name && (
                <p id="b-name-error" role="alert" className="text-xs text-destructive">
                  {fieldErrors.customer_name}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-email">{t("booking.email")}</Label>
              <Input
                id="b-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? "b-email-error" : undefined}
              />
              {fieldErrors.email && (
                <p id="b-email-error" role="alert" className="text-xs text-destructive">
                  {fieldErrors.email}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-phone">{t("booking.phone")}</Label>
              <Input
                id="b-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-invalid={Boolean(fieldErrors.phone)}
                aria-describedby={fieldErrors.phone ? "b-phone-error" : undefined}
              />
              {fieldErrors.phone && (
                <p id="b-phone-error" role="alert" className="text-xs text-destructive">
                  {fieldErrors.phone}
                </p>
              )}
            </div>

            {submitError && (
              <p role="alert" className="text-sm text-destructive">
                {submitError}
              </p>
            )}

            <DialogFooter className="-mx-4 -mb-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t("booking.cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting || !quoteReady}>
                {isSubmitting ? t("booking.submitting") : t("booking.confirm")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
