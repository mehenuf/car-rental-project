import { titleFromKey } from "@/lib/seo/metadata";
import { Link } from "@/lib/i18n/link";
import { BookingNotFound } from "@/components/site/booking-not-found";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { AutoRefresh } from "@/components/site/auto-refresh";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatBookingTotal, formatDate } from "@/lib/format";
import { isHoldActive } from "@/lib/payments/hold";
import { getBookingByReference, getBranchCity } from "@/lib/queries";
import { readRequestIdentity } from "@/lib/guest";
import { getLocale, getT } from "@/lib/i18n/dictionary";

export async function generateMetadata() {
  return titleFromKey("meta.bookingConfirmation");
}

export default async function BookingConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  if (!ref) return <BookingNotFound />;

  const booking = await getBookingByReference(ref);
  if (!booking) return <BookingNotFound />;
  const t = await getT();
  const locale = await getLocale();

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
  if (hasOwner && !isOwner) return <BookingNotFound />;

  const pickupCity = booking.pickup_branch_id ? await getBranchCity(booking.pickup_branch_id) : null;
  const paid = booking.payment_status === "paid" || booking.payment_status === "partially_refunded";
  const refunded = booking.payment_status === "refunded";
  const cancelled = booking.status === "cancelled" || booking.status === "no_show";
  const awaitingPayment =
    booking.status === "pending" && booking.payment_status === "unpaid" && Boolean(booking.price_snapshot) && isHoldActive(booking.hold_expires_at);

  let icon = <Clock className="size-8" />;
  let title = t("confirmation.receivedTitle");
  let message = t("confirmation.receivedBody");

  if (cancelled) {
    icon = <XCircle className="size-8" />;
    title = t("confirmation.cancelledTitle");
    message = refunded ? t("confirmation.cancelledRefundedBody") : t("confirmation.cancelledBody");
  } else if (paid) {
    icon = <CheckCircle2 className="size-8" />;
    title = t("confirmation.confirmedTitle");
    message = t("confirmation.confirmedBody");
  } else if (awaitingPayment) {
    title = t("confirmation.payTitle");
    message = t("confirmation.payBody");
  } else if (booking.status === "pending" && booking.payment_status === "unpaid" && booking.hold_expires_at) {
    icon = <XCircle className="size-8" />;
    title = t("confirmation.expiredTitle");
    message = t("confirmation.expiredBody");
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
          <Row label={t("confirmation.reference")} value={booking.reference} />
          <Row label={t("confirmation.vehicle")} value={booking.vehicle?.name ?? "-"} />
          <Row label={t("confirmation.pickUp")} value={formatDate(booking.pickup_at, locale)} />
          {pickupCity && <Row label={t("confirmation.pickUpAt")} value={pickupCity} />}
          <Row label={t("confirmation.dropOff")} value={formatDate(booking.dropoff_at, locale)} />
          <Row label={t("confirmation.total")} value={formatBookingTotal(booking, locale)} emphasize />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-(--space-xs) sm:flex-row">
        {awaitingPayment && (
          <Link href={`/checkout/${encodeURIComponent(booking.reference)}`} className={buttonVariants({ size: "lg" })}>
            {t("confirmation.payNow")}
          </Link>
        )}
        <Link href="/account" className={buttonVariants({ variant: "outline", size: "lg" })}>
          {t("confirmation.viewBookings")}
        </Link>
        <Link href="/cars" className={buttonVariants({ variant: awaitingPayment ? "outline" : "default", size: "lg" })}>
          {t("confirmation.browseMore")}
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
    <div className="flex items-center justify-between border-b border-border pb-(--space-xs) text-start last:border-0 last:pb-0">
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
