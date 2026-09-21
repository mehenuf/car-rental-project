import { titleFromKey } from "@/lib/seo/metadata";
import { redirect } from "next/navigation";
import { BookingNotFound } from "@/components/site/booking-not-found";
import { getLocale } from "@/lib/i18n/dictionary";
import { withLocale } from "@/lib/i18n/negotiate";
import { CheckoutForm } from "@/components/site/checkout-form";
import { readRequestIdentity } from "@/lib/guest";
import { paymentsRepo } from "@/lib/payments/repo";
import { checkoutMethods, stripeEnabled } from "@/lib/payments/registry";
import { getBookingByReference } from "@/lib/queries";

export async function generateMetadata() {
  return titleFromKey("meta.checkout");
}

export default async function CheckoutPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;

  const [booking, display] = await Promise.all([
    paymentsRepo.getBookingByReference(reference),
    getBookingByReference(reference),
  ]);
  if (!booking || !display) return <BookingNotFound />;

  // Only the browser or account that created the booking may pay for it.
  const identity = await readRequestIdentity();
  const isOwner =
    (booking.user_id !== null && booking.user_id === identity.userId) ||
    (booking.guest_id !== null && booking.guest_id === identity.guestId);
  if (!isOwner) return <BookingNotFound />;

  // Already paid, cancelled or expired: the confirmation page explains the state.
  const snapshot = booking.price_snapshot;
  if (booking.payment_status !== "unpaid" || booking.status !== "pending" || !snapshot || !booking.currency) {
    redirect(withLocale(await getLocale(), `/booking-confirmation?ref=${encodeURIComponent(reference)}`));
  }

  const methods = checkoutMethods(booking.country_code ?? "", booking.currency).map((m) => ({
    code: m.code,
    label: m.label,
    testHint: m.testHint,
  }));

  return (
    <CheckoutForm
      reference={booking.reference}
      vehicleName={display.vehicle?.name ?? "Your rental"}
      currency={booking.currency}
      totalMinor={snapshot.quote.totalMinor}
      depositMinor={snapshot.quote.depositMinor ?? 0}
      lines={snapshot.quote.lines ?? []}
      days={snapshot.quote.days ?? 1}
      holdExpiresAt={booking.hold_expires_at}
      methods={methods}
      stripe={{
        enabled: stripeEnabled(),
        publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null,
      }}
    />
  );
}
