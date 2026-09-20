import Link from "next/link";
import { CalendarClock, Car, MapPin, TicketCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { BookingStatusBadge } from "@/components/admin/booking-status-badge";
import { VehicleImage } from "@/components/site/vehicle-image";
import { formatCurrency, formatDate } from "@/lib/format";
import { CancelBookingButton } from "@/components/site/cancel-booking-button";
import { isHoldActive } from "@/lib/payments/hold";
import { getBookingsForIdentity } from "@/lib/queries";
import { readRequestIdentity } from "@/lib/guest";

export const metadata = {
  title: "My Bookings",
};

export default async function DashboardPage() {
  const identity = await readRequestIdentity();
  const bookings = identity.userId || identity.guestId
    ? await getBookingsForIdentity(identity)
    : [];

  const displayName =
    (identity.user?.user_metadata?.full_name as string | undefined) ||
    identity.user?.email ||
    "there";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-(--space-lg) px-(--space-sm) py-(--space-xl)">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          {identity.user ? `Welcome back, ${displayName}` : "My Bookings"}
        </h1>
        <p className="text-muted-foreground">
          {identity.user
            ? "Everything you've booked with BestCar, in one place."
            : "Bookings made from this browser show up here, even without an account."}
        </p>
      </div>

      {bookings.length === 0 ? (
        <Card className="shadow-card ring-0">
          <CardContent className="py-(--space-xl)">
            <EmptyState
              icon={TicketCheck}
              title="No bookings yet"
              description="Once you book a car, its status and details will show up here."
              action={
                <Link href="/cars" className={buttonVariants({ size: "lg" })}>
                  Browse cars
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
                    <VehicleImage
                      src={booking.vehicle.image_url}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-muted-foreground">
                      <Car className="size-6" aria-hidden />
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-heading text-base font-semibold text-foreground">
                      {booking.vehicle?.name ?? "Vehicle unavailable"}
                    </p>
                    <BookingStatusBadge status={booking.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="size-3.5" aria-hidden />
                      {formatDate(booking.pickup_at)} &rarr; {formatDate(booking.dropoff_at)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" aria-hidden />
                      Ref {booking.reference}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 text-left sm:items-end sm:text-right">
                  <div>
                    <p className="font-heading text-lg font-bold text-foreground">
                      {formatCurrency(booking.total_amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {booking.days} day{booking.days === 1 ? "" : "s"}
                      {booking.payment_status === "paid" ? " · Paid" : ""}
                      {booking.payment_status === "refunded" ? " · Refunded" : ""}
                      {booking.payment_status === "partially_refunded" ? " · Partly refunded" : ""}
                    </p>
                  </div>
                  {booking.status === "pending" &&
                    booking.payment_status === "unpaid" &&
                    booking.price_snapshot &&
                    isHoldActive(booking.hold_expires_at) && (
                      <Link
                        href={`/checkout/${encodeURIComponent(booking.reference)}`}
                        className={buttonVariants({ size: "sm" })}
                      >
                        Pay now
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
