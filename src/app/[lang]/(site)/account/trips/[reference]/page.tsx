import { titleFromKey } from "@/lib/seo/metadata";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/lib/i18n/link";
import { Lock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { MessageThread } from "@/components/site/message-thread";
import { DisputePanel } from "@/components/site/dispute-panel";
import { ReviewForm } from "@/components/site/review-form";
import { canEditReview, isReviewWindowOpen } from "@/lib/reviews/rules";
import { disputeWindowEnds } from "@/lib/disputes/rules";
import { supabaseAdmin } from "@/lib/supabase-server";
import { Card, CardContent } from "@/components/ui/card";
import { BookingStatusBadge } from "@/components/admin/booking-status-badge";
import { getTrip } from "@/lib/account/trips";
import { formatBookingTotal, formatDate } from "@/lib/format";
import { readRequestIdentity } from "@/lib/guest";
import { getLocale, getT } from "@/lib/i18n/dictionary";
import { withLocale } from "@/lib/i18n/negotiate";

export async function generateMetadata() {
  return titleFromKey("meta.trip");
}

export default async function TripPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const locale = await getLocale();
  const t = await getT();
  const identity = await readRequestIdentity();
  if (!identity.userId) redirect(withLocale(locale, "/login?next=" + encodeURIComponent(`/account/trips/${reference}`)));

  const trip = await getTrip(identity.userId, decodeURIComponent(reference));
  if (!trip) notFound();
  const { booking, pickup, provider, receipt } = trip;

  const completedAt = booking.completed_at ? new Date(booking.completed_at) : null;
  const now = new Date();
  const completed = booking.status === "completed" && completedAt !== null;
  const canReview = completed && isReviewWindowOpen(completedAt, now);
  const canOpenDispute = completed && now <= disputeWindowEnds(completedAt);
  const { data: myReview } = completed
    ? await supabaseAdmin.from("reviews").select("id, overall, aspects, comment, status, submitted_at").eq("booking_id", booking.id).eq("direction", "customer_to_provider").maybeSingle()
    : { data: null };

  return (
    <div className="flex flex-col gap-(--space-md)">
      <Link href="/account" className="w-fit text-sm text-muted-foreground hover:text-foreground">
        {t("trip.back")}
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-heading text-2xl font-bold text-foreground">{booking.vehicle?.name ?? t("trip.title")}</h1>
        <BookingStatusBadge status={booking.status} label={t(`portal.status.${booking.status}`)} />
      </div>

      <Card className="shadow-card ring-0">
        <CardContent className="flex flex-col gap-(--space-xs)">
          <Row label={t("trip.reference")} value={booking.reference} />
          <Row label={t("trip.pickup")} value={formatDate(booking.pickup_at, locale)} />
          <Row label={t("trip.dropoff")} value={formatDate(booking.dropoff_at, locale)} />
          <Row label={t("trip.total")} value={formatBookingTotal(booking, locale)} />
        </CardContent>
      </Card>

      {pickup ? (
        <Card className="shadow-card ring-0">
          <CardContent className="flex flex-col gap-(--space-xs)">
            <Row label={t("trip.address")} value={[pickup.address, pickup.branchName, pickup.city].filter(Boolean).join(", ")} />
            {provider && <Row label={t("trip.provider")} value={provider.displayName} />}
            {provider?.phone && <Row label={t("trip.phone")} value={provider.phone} />}
          </CardContent>
        </Card>
      ) : (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("trip.locked")}
        </p>
      )}

      {booking.provider_id && !["cancelled", "no_show", "completed"].includes(booking.status) && (
        <Card className="shadow-card ring-0">
          <CardContent className="flex flex-col gap-(--space-xs)">
            <h2 className="font-heading text-base font-semibold text-foreground">{t("messages.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("messages.hint")}</p>
            <MessageThread
              bookingId={booking.id}
              endpoint="/api/account/messages"
              mySide="customer"
              locale={locale}
              labels={{
                empty: t("messages.empty"),
                placeholder: t("messages.placeholder"),
                send: t("messages.send"),
                sending: t("messages.sending"),
                you: t("messages.you"),
                them: t("messages.them"),
                platform: t("messages.platform"),
                loadFailed: t("messages.loadFailed"),
              }}
            />
          </CardContent>
        </Card>
      )}

      {completed && (canReview || myReview) && (
        <Card className="shadow-card ring-0">
          <CardContent className="flex flex-col gap-(--space-xs)">
            <h2 className="font-heading text-base font-semibold text-foreground">{t("reviews.rate")}</h2>
            {myReview && <p className="text-xs text-muted-foreground">{t("reviews.thanks")}</p>}
            <ReviewForm
              bookingId={booking.id}
              existing={myReview ? { id: myReview.id, overall: myReview.overall, aspects: myReview.aspects, comment: myReview.comment, editable: canEditReview({ status: myReview.status, submittedAt: new Date(myReview.submitted_at), now }) } : null}
            />
          </CardContent>
        </Card>
      )}

      {completed && (
        <Card className="shadow-card ring-0">
          <CardContent>
            <DisputePanel bookingId={booking.id} currency={booking.currency ?? "USD"} canOpen={canOpenDispute} />
          </CardContent>
        </Card>
      )}

      {receipt && (
        <Link
          href={`/account/receipts/${encodeURIComponent(receipt.number)}`}
          className={buttonVariants({ variant: "outline", className: "w-fit" })}
        >
          {t("trip.receipt")}
        </Link>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border pb-(--space-xs) text-start last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-end font-medium text-foreground">{value}</span>
    </div>
  );
}
