"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { CreateBookingSchema } from "@/lib/schemas";
import { formatCurrency } from "@/lib/format";
import type { Tables } from "@/types/database";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDateParam(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

/** Matches the `days` generated column / createBooking's server-side formula. */
function daysBetween(pickup: Date, dropoff: Date): number {
  const diff = Math.floor((dropoff.getTime() - pickup.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff);
}

interface BookingResponse {
  reference: string;
  pickup_at: string;
  dropoff_at: string;
  total_amount: number;
}

export function VehicleBookingPanel({
  vehicle,
  defaultPickupDate,
  defaultDropoffDate,
}: {
  vehicle: Tables<"vehicles">;
  defaultPickupDate?: string;
  defaultDropoffDate?: string;
}) {
  const router = useRouter();
  const today = startOfToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [pickupDate, setPickupDate] = useState<Date | undefined>(() =>
    parseDateParam(defaultPickupDate, today)
  );
  const [dropoffDate, setDropoffDate] = useState<Date | undefined>(() =>
    parseDateParam(defaultDropoffDate, tomorrow)
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const days = pickupDate && dropoffDate ? daysBetween(pickupDate, dropoffDate) : 1;
  const total = vehicle.price_per_day * days;
  const datesValid = Boolean(pickupDate && dropoffDate && dropoffDate > pickupDate);

  function handlePickupChange(date: Date | undefined) {
    setPickupDate(date);
    if (date && dropoffDate && dropoffDate <= date) {
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      setDropoffDate(next);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pickupDate || !dropoffDate) return;

    const result = CreateBookingSchema.safeParse({
      vehicle_id: vehicle.id,
      customer_name: name,
      email,
      phone: phone.trim() ? phone : undefined,
      pickup_at: pickupDate,
      dropoff_at: dropoffDate,
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
        }),
      });
      const body = (await res.json()) as BookingResponse | { error: { message: string } };
      if (!res.ok) {
        throw new Error("error" in body ? body.error.message : "Failed to create booking");
      }
      const booking = body as BookingResponse;

      const params = new URLSearchParams({
        ref: booking.reference,
        car: vehicle.name,
        pickupDate: booking.pickup_at,
        dropoffDate: booking.dropoff_at,
        total: String(booking.total_amount),
      });
      router.push(`/booking-confirmation?${params.toString()}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create booking");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="shadow-card ring-0">
      <CardContent className="flex flex-col gap-(--space-sm)">
        <div className="flex items-baseline gap-1">
          <span className="font-heading text-2xl font-bold text-foreground">
            {formatCurrency(vehicle.price_per_day)}
          </span>
          <span className="text-sm text-muted-foreground">/day</span>
        </div>

        <div className="grid grid-cols-2 gap-(--space-sm)">
          <DatePickerField
            label="Pick-up"
            value={pickupDate}
            onChange={handlePickupChange}
            minDate={today}
          />
          <DatePickerField
            label="Drop-off"
            value={dropoffDate}
            onChange={setDropoffDate}
            minDate={pickupDate ?? today}
          />
        </div>

        <div className="flex items-center justify-between border-t border-border pt-(--space-sm) text-sm">
          <span className="text-muted-foreground">
            {days} day{days === 1 ? "" : "s"} &times; {formatCurrency(vehicle.price_per_day)}
          </span>
          <span className="font-medium text-foreground">{formatCurrency(total)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-(--space-sm)">
          <span className="font-heading text-base font-semibold text-foreground">Total</span>
          <span className="font-heading text-xl font-bold text-accent">{formatCurrency(total)}</span>
        </div>

        <Button
          type="button"
          size="lg"
          disabled={!datesValid}
          onClick={() => setDialogOpen(true)}
          data-chat-avoid
        >
          Book Now
        </Button>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete your booking</DialogTitle>
            <DialogDescription>
              {vehicle.name} &mdash; {days} day{days === 1 ? "" : "s"} for {formatCurrency(total)}
            </DialogDescription>
          </DialogHeader>
          <form className="flex flex-col gap-(--space-sm)" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-name">Full name</Label>
              <Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} />
              {fieldErrors.customer_name && (
                <p className="text-xs text-destructive">{fieldErrors.customer_name}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-email">Email</Label>
              <Input
                id="b-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-phone">Phone (optional)</Label>
              <Input id="b-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              {fieldErrors.phone && <p className="text-xs text-destructive">{fieldErrors.phone}</p>}
            </div>

            {submitError && <p className="text-sm text-destructive">{submitError}</p>}

            <DialogFooter className="-mx-4 -mb-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Booking..." : "Confirm Booking"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
