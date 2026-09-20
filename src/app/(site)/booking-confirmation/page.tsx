import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type { Metadata } from "next";
import { AutoRefresh } from "@/components/site/auto-refresh";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import { isHoldActive } from "@/lib/payments/hold";
import { getBookingByReference } from "@/lib/queries";
import { readRequestIdentity } from "@/lib/guest";

export const metadata: Metadata = { title: "Your Booking" };

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

  const vehicleName = booking.vehicle ? ` for the ${booking.vehicle.name}` : "";
  const paid = booking.payment_status === "paid" || booking.payment_status === "partially_refunded";
  const refunded = booking.payment_status === "refunded";
  const cancelled = booking.status === "cancelled" || booking.status === "no_show";
  const awaitingPayment =
    booking.status === "pending" && booking.payment_status === "unpaid" && Boolean(booking.price_snapshot) && isHoldActive(booking.hold_expires_at);

  let icon = <Clock className="size-8" />;
  let title = "Booking Received";
  let message = `Your booking${vehicleName} has been received and is awaiting confirmation. We'll email you as soon as it's confirmed.`;

  if (cancelled) {
    icon = <XCircle className="size-8" />;
    title = "Booking Cancelled";
    message = refunded
      ? `Your booking${vehicleName} was cancelled and your payment has been refunded.`
      : `Your booking${vehicleName} was cancelled.`;
  } else if (paid) {
    icon = <CheckCircle2 className="size-8" />;
    title = "Booking Confirmed";
    message = `Your payment was received and your booking${vehicleName} is confirmed. See you at pick-up.`;
  } else if (awaitingPayment) {
    title = "Complete Your Payment";
    message = `Your booking${vehicleName} is held for you. Finish paying to confirm it. If you have just paid, this page updates in a moment.`;
  } else if (booking.status === "pending" && booking.payment_status === "unpaid" && booking.hold_expires_at) {
    icon = <XCircle className="size-8" />;
    title = "Booking Expired";
    message = "The payment window for this booking has passed and the car has been released. You have not been charged.";
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-(--space-md) px-(--space-sm) py-(--space-2xl) text-center">
      {awaitingPayment && <AutoRefresh />}
      <div className="flex size-16 items-center justify-center rounded-full bg-accent/10 text-accent-text">{icon}</div>
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-bold text-foreground">{title}</h1>
        <p className="text-muted-foreground">{message}</p>
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
        {awaitingPayment && (
          <Link href={`/checkout/${encodeURIComponent(booking.reference)}`} className={buttonVariants({ size: "lg" })}>
            Pay now
          </Link>
        )}
        <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "lg" })}>
          View my bookings
        </Link>
        <Link href="/cars" className={buttonVariants({ variant: awaitingPayment ? "outline" : "default", size: "lg" })}>
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
