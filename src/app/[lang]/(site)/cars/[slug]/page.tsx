import { jsonLdString, vehicleLd } from "@/lib/seo/jsonld";
import { localizedUrl } from "@/lib/seo/urls";
import { getLocale } from "@/lib/i18n/dictionary";
import { pageMetadata } from "@/lib/seo/metadata";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Check, Cog, DoorOpen, Fuel as FuelIcon, Star, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { getVehicleBySlug, getVehicleCards, getVehiclePlace, getVehicleTranslation } from "@/lib/queries";
import { isTemplateDescription } from "@/lib/vehicle-place";
import { formatMinor } from "@/lib/pricing/money";
import { numberingLocale } from "@/lib/i18n/locales";
import { localizedVehicleText } from "@/lib/i18n/vehicle-text";
import { Badge } from "@/components/ui/badge";
import { VehicleGallery } from "@/components/site/vehicle-gallery";
import { VehicleBookingPanel } from "@/components/site/vehicle-booking-panel";
import { VehicleCard } from "@/components/site/vehicle-card";
import { ScrollReveal } from "@/components/site/scroll-reveal";
import { VehicleReviews } from "@/components/site/vehicle-reviews";
import { getT } from "@/lib/i18n/dictionary";
import type { Tables } from "@/types/database";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const vehicle = await getVehicleBySlug(slug);
  if (!vehicle) return {};
  const t = await getT();

  // The name already carries the brand ("Honda Civic"), so the title is just the name.
  return pageMetadata(`/cars/${slug}`, {
    title: vehicle.name,
    description: t("meta.vehicle", {
      name: vehicle.name,
      category: t(`enums.category.${vehicle.category}`),
      rating: vehicle.rating.toFixed(1),
      count: vehicle.review_count,
    }),
  });
}

function toBranchId(value: string | undefined): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export default async function VehicleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    pickupDate?: string;
    dropoffDate?: string;
    pickupTime?: string;
    dropoffTime?: string;
    pickupLocationId?: string;
    dropoffLocationId?: string;
  }>;
}) {
  const { slug } = await params;
  const { pickupDate, dropoffDate, pickupTime, dropoffTime, pickupLocationId, dropoffLocationId } = await searchParams;
  const t = await getT();
  const locale = await getLocale();

  const vehicle = await getVehicleBySlug(slug);
  if (!vehicle) notFound();

  // The branch whose city and daily rate the page shows, and the branch the quote is priced from.
  const [place, translation] = await Promise.all([
    getVehiclePlace(vehicle.id, toBranchId(pickupLocationId)),
    getVehicleTranslation(vehicle.id, locale),
  ]);

  const text = localizedVehicleText(vehicle, translation);
  const images = [vehicle.image_url, ...vehicle.gallery.filter((url) => url !== vehicle.image_url)];

  return (
    <div className="mx-auto max-w-7xl px-(--space-sm) py-(--space-lg)">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(vehicleLd(vehicle, localizedUrl(locale, `/cars/${slug}`))) }} />
      <div className="grid grid-cols-1 gap-(--space-lg) lg:grid-cols-[1.6fr_1fr] lg:items-start">
        {/* On phones the order is photos, name and specs, then the booking panel, then the details, so the price and the
            action are one scroll away instead of below every feature. From lg the panel sits in the second column. */}
        <div className="flex flex-col gap-(--space-lg) lg:col-start-1 lg:row-start-1">
          <VehicleGallery images={images} name={vehicle.name} />

          <div className="flex flex-col gap-(--space-sm)">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <Badge variant="outline" className="w-fit capitalize">
                  {t(`enums.category.${vehicle.category}`)}
                </Badge>
                <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
                  {vehicle.name}
                </h1>
                {!vehicle.name.toLowerCase().startsWith(vehicle.brand.toLowerCase()) && (
                  <p className="text-muted-foreground">{vehicle.brand}</p>
                )}
                {place && (
                  <p className="text-sm text-muted-foreground lg:hidden">
                    {t("booking.from")}{" "}
                    <span className="font-semibold text-foreground">
                      {formatMinor(place.dailyMinor, place.currency, numberingLocale(locale))}
                    </span>
                    {t("vehicle.perDay")} · {place.city}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-accent-text">
                <Star className="size-5 fill-current" />
                <span className="font-semibold text-foreground">{vehicle.rating.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">
                  {t("vehicle.reviews", { count: vehicle.review_count })}
                </span>
              </div>
            </div>

            <div
              data-chat-avoid
              className="grid grid-cols-2 gap-(--space-sm) rounded-xl border border-border p-(--space-sm) sm:grid-cols-4"
            >
              <Spec icon={Users} label={t("vehicle.seats")} value={String(vehicle.seats)} />
              <Spec icon={DoorOpen} label={t("vehicle.doors")} value={String(vehicle.doors)} />
              <Spec icon={Cog} label={t("vehicle.transmission")} value={t(`enums.transmission.${vehicle.transmission}`)} />
              <Spec icon={FuelIcon} label={t("vehicle.fuel")} value={t(`enums.fuel.${vehicle.fuel}`)} />
            </div>
          </div>
        </div>

        <div className="lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <VehicleBookingPanel
            vehicle={vehicle}
            defaultPickupDate={pickupDate}
            defaultPickupTime={pickupTime}
            defaultDropoffTime={dropoffTime}
            defaultDropoffDate={dropoffDate}
            place={place}
            pickupBranchId={place?.branchId ?? toBranchId(pickupLocationId)}
            dropoffBranchId={toBranchId(dropoffLocationId)}
          />
        </div>

        {(!isTemplateDescription(text.description) || text.features.length > 0) && (
          <div className="flex flex-col gap-(--space-sm) lg:col-start-1 lg:row-start-2">
            {!isTemplateDescription(text.description) && (
              <p className="text-muted-foreground">{text.description}</p>
            )}

            {text.features.length > 0 && (
              <ScrollReveal className="flex flex-col gap-2" delay={0.12}>
                <h2 className="font-heading text-lg font-semibold text-foreground">{t("vehicle.features")}</h2>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {text.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="size-4 shrink-0 text-accent-text" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </ScrollReveal>
            )}
          </div>
        )}
      </div>

      <div className="mt-(--space-xl)">
        <VehicleReviews vehicleId={vehicle.id} />
      </div>

      {/* Streams in after the page: the photo, price and booking panel do not wait for this list. */}
      <Suspense fallback={<div className="mt-(--space-xl) min-h-72" aria-hidden />}>
        <SimilarVehicles vehicleId={vehicle.id} category={vehicle.category} />
      </Suspense>
    </div>
  );
}

async function SimilarVehicles({ vehicleId, category }: { vehicleId: string; category: Tables<"vehicles">["category"] }) {
  const t = await getT();
  const { data } = await getVehicleCards({ category: [category], pageSize: 4 });
  const similar = data.filter((v) => v.id !== vehicleId).slice(0, 3);
  if (similar.length === 0) return null;
  return (
    <ScrollReveal className="mt-(--space-xl) flex flex-col gap-(--space-md)" delay={0.2}>
      <h2 className="font-heading text-lg font-semibold text-foreground">{t("vehicle.similar")}</h2>
      <div className="grid grid-cols-1 gap-(--space-sm) sm:grid-cols-2 lg:grid-cols-3">
        {similar.map((v) => (
          <VehicleCard key={v.id} vehicle={v} />
        ))}
      </div>
    </ScrollReveal>
  );
}

function Spec({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <Icon className="size-5 text-accent-text" />
      <span className="text-sm font-medium text-foreground capitalize">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
