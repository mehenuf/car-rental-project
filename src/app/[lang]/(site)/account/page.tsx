import { titleFromKey } from "@/lib/seo/metadata";
import { Link } from "@/lib/i18n/link";
import { CalendarClock, Car, MapPin, TicketCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { BookingStatusBadge } from "@/components/admin/booking-status-badge";
import { ClaimBookings } from "@/components/site/claim-bookings";
import { VehicleImage } from "@/components/site/vehicle-image";
import { CancelBookingButton } from "@/components/site/cancel-booking-button";
import { countClaimable } from "@/lib/account/trips";
import { formatBookingTotal, formatDate } from "@/lib/format";
import { readRequestIdentity } from "@/lib/guest";
import { getLocale, getT } from "@/lib/i18n/dictionary";
import { isHoldActive } from "@/lib/payments/hold";
import { getBookingsForIdentity } from "@/lib/queries";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function generateMetadata() {
  return titleFromKey("meta.account");
}

export default async function AccountPage() {
  const t = await getT();
  const locale = await getLocale();
  const identity = await readRequestIdentity();
  const bookings =
    identity.userId || identity.guestId ? await getBookingsForIdentity(identity) : [];

  const user = identity.user;
  const verifiedEmail = user?.email && user.email_confirmed_at ? user.email : null;
  const claimable = verifiedEmail ? await countClaimable(verifiedEmail) : 0;

  let licenceStatus: string | null = null;
  if (user) {
    const { data } = await supabaseAdmin.from("driver_profiles").select("status").eq("user_id", user.id).maybeSingle();
    licenceStatus = data?.status ?? "unverified";
  }

  const displayName = (user?.user_metadata?.full_name as string | undefined) || user?.email || "";

  return (
    <div className="flex flex-col gap-(--space-lg)">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          {user ? t("account.welcome", { name: displayName }) : t("account.guestTitle")}
        </h1>
        <p className="text-muted-foreground">{user ? t("account.signedInBody") : t("account.guestBody")}</p>
        {!user && (
          <Link href="/register" className={buttonVariants({ variant: "outline", size: "sm", className: "mt-2 w-fit" })}>
            {t("account.createAccount")}
          </Link>
        )}
      </div>

      {claimable > 0 && <ClaimBookings count={claimable} />}

      {user && licenceStatus && licenceStatus !== "verified" && (
        <Card className="shadow-card ring-0">
          <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-heading text-base font-semibold text-foreground">{t("account.licenceTitle")}</h2>
              <p className="text-sm text-muted-foreground">
                {t(`account.status.${licenceStatus}`)}. {t("account.licenceNeeded")}
              </p>
            </div>
            <Link href="/account/driver" className={buttonVariants({ size: "sm" })}>
              {t("account.manageLicence")}
            </Link>
          </CardContent>
        </Card>
      )}

      {bookings.length === 0 ? (
        <Card className="shadow-card ring-0">
          <CardContent className="py-(--space-xl)">
            <EmptyState
              icon={TicketCheck}
              title={t("account.noBookings")}
              description={t("account.noBookingsBody")}
              action={
                <Link href="/cars" className={buttonVariants({ size: "lg" })}>
                  {t("common.browseCars")}
                </Link>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-(--space-sm)">
          {bookings.map((booking) => (
            <Card key={booking.id} className="shadow-card ring-0">
              <CardContent className="flex flex-col gap-(--space-sm) sm:flex-row sm:items-center">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {booking.vehicle?.image_url ? (
                    <VehicleImage src={booking.vehicle.image_url} alt="" fill sizes="64px" className="object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-muted-foreground">
                      <Car className="size-6" aria-hidden />
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-heading text-base font-semibold text-foreground">
                      {booking.vehicle?.name ?? t("account.vehicleUnavailable")}
                    </p>
                    <BookingStatusBadge status={booking.status} label={t(`portal.status.${booking.status}`)} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="size-3.5" aria-hidden />
                      {formatDate(booking.pickup_at, locale)} &rarr; {formatDate(booking.dropoff_at, locale)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" aria-hidden />
                      {t("account.ref", { reference: booking.reference })}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 text-start sm:items-end sm:text-end">
                  <div>
                    <p className="font-heading text-lg font-bold text-foreground">
                      {formatBookingTotal(booking, locale)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("account.days", { count: booking.days })}
                      {booking.payment_status === "paid" ? ` · ${t("account.paid")}` : ""}
                      {booking.payment_status === "refunded" ? ` · ${t("account.refunded")}` : ""}
                      {booking.payment_status === "partially_refunded" ? ` · ${t("account.partlyRefunded")}` : ""}
                    </p>
                  </div>
                  {user && (
                    <Link
                      href={`/account/trips/${encodeURIComponent(booking.reference)}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      {t("account.viewTrip")}
                    </Link>
                  )}
                  {booking.status === "pending" &&
                    booking.payment_status === "unpaid" &&
                    booking.price_snapshot &&
                    isHoldActive(booking.hold_expires_at) && (
                      <Link
                        href={`/checkout/${encodeURIComponent(booking.reference)}`}
                        className={buttonVariants({ size: "sm" })}
                      >
                        {t("account.payNow")}
                      </Link>
                    )}
                  {(booking.status === "pending" || booking.status === "confirmed") && (
                    <CancelBookingButton
                      bookingId={booking.id}
                      currency={booking.currency}
                      paid={booking.payment_status === "paid"}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
