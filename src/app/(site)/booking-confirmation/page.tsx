import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock } from "lucide-react";
import type { Metadata } from "next";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import { getBookingByReference } from "@/lib/queries";
import { readRequestIdentity } from "@/lib/guest";

export const metadata: Metadata = { title: "Booking Confirmed" };

export default async function BookingConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  if (!ref) notFound();

  const booking = await getBookingByReference(ref);
  if (!booking) notFound();

  // The reference alone (a 3-byte hex string) is brute-forceable, so it
  // can't be the only gate on viewing someone else's booking details.
  // Every booking created after the guest/user identity migration carries
  // a guest_id or user_id set from the requester's own cookie/session at
  // creation time — require that same identity to view it. Bookings from
  // before that migration have neither column set, so they're left
  // unrestricted rather than breaking access to pre-existing data.
  const identity = await readRequestIdentity();
  const hasOwner = Boolean(booking.user_id || booking.guest_id);
  const isOwner =
    (booking.user_id !== null && booking.user_id === identity.userId) ||
    (booking.guest_id !== null && booking.guest_id === identity.guestId);
  if (hasOwner && !isOwner) notFound();

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-(--space-md) px-(--space-sm) py-(--space-2xl) text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-accent/10 text-accent-text">
        <Clock className="size-8" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-bold text-foreground">Booking Received</h1>
        <p className="text-muted-foreground">
          Your booking{booking.vehicle ? ` for the ${booking.vehicle.name}` : ""} has been
          received and is awaiting confirmation. We&apos;ll email you as soon as it&apos;s
          confirmed, no payment has been taken yet.
        </p>
      </div>

      <Card className="w-full shadow-card ring-0">
        <CardContent className="flex flex-col gap-(--space-sm)">
          <Row label="Reference" value={booking.reference} />
          <Row label="Vehicle" value={booking.vehicle?.name ?? "-"} />
          <Row label="Pick-up" value={formatDate(booking.pickup_at)} />
          <Row label="Drop-off" value={formatDate(booking.dropoff_at)} />
          <Row label="Total" value={formatCurrency(booking.total_amount)} emphasize />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-(--space-xs) sm:flex-row">
        <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "lg" })}>
          View my bookings
        </Link>
        <Link href="/cars" className={buttonVariants({ size: "lg" })}>
          Browse more cars
        </Link>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-(--space-xs) text-left last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={
          emphasize
            ? "font-heading text-lg font-bold text-accent-text"
            : "font-medium text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}
