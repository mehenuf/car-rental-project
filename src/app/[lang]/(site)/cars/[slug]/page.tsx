import { jsonLdString, vehicleLd } from "@/lib/seo/jsonld";
import { localizedUrl } from "@/lib/seo/urls";
import { getLocale } from "@/lib/i18n/dictionary";
import { pageMetadata } from "@/lib/seo/metadata";
import { notFound } from "next/navigation";
import { Check, Cog, DoorOpen, Fuel as FuelIcon, Star, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { getVehicleBySlug, getVehicleCards, getVehicleTranslation } from "@/lib/queries";
import { localizedVehicleText } from "@/lib/i18n/vehicle-text";
import { Badge } from "@/components/ui/badge";
import { VehicleGallery } from "@/components/site/vehicle-gallery";
import { VehicleBookingPanel } from "@/components/site/vehicle-booking-panel";
import { VehicleCard } from "@/components/site/vehicle-card";
import { ScrollReveal } from "@/components/site/scroll-reveal";
import { VehicleReviews } from "@/components/site/vehicle-reviews";
import { getT } from "@/lib/i18n/dictionary";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const vehicle = await getVehicleBySlug(slug);
  if (!vehicle) return {};

  return pageMetadata(`/cars/${slug}`, {
    title: `${vehicle.name} — ${vehicle.brand}`,
    description: `Rent the ${vehicle.name} from ${vehicle.brand}. ${vehicle.category} category, rated ${vehicle.rating.toFixed(1)}/5 from ${vehicle.review_count} reviews.`,
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
    pickupLocationId?: string;
    dropoffLocationId?: string;
  }>;
}) {
  const { slug } = await params;
  const { pickupDate, dropoffDate, pickupLocationId, dropoffLocationId } = await searchParams;
  const t = await getT();
  const locale = await getLocale();

  const vehicle = await getVehicleBySlug(slug);
  if (!vehicle) notFound();

  const { data: sameCategory } = await getVehicleCards({
    category: [vehicle.category],
    pageSize: 4,
  });
  const similar = sameCategory.filter((v) => v.id !== vehicle.id).slice(0, 3);

  const text = localizedVehicleText(vehicle, await getVehicleTranslation(vehicle.id, locale));
  const images = [vehicle.image_url, ...vehicle.gallery.filter((url) => url !== vehicle.image_url)];

  return (
    <div className="mx-auto max-w-7xl px-(--space-sm) py-(--space-lg)">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(vehicleLd(vehicle, localizedUrl(locale, `/cars/${slug}`))) }} />
      <div className="grid grid-cols-1 gap-(--space-lg) lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <div className="flex flex-col gap-(--space-lg)">
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
                <p className="text-muted-foreground">{vehicle.brand}</p>
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

            {text.description && (
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
        </div>

        <div className="lg:sticky lg:top-24">
          <VehicleBookingPanel
            vehicle={vehicle}
            defaultPickupDate={pickupDate}
            defaultDropoffDate={dropoffDate}
            pickupBranchId={toBranchId(pickupLocationId)}
            dropoffBranchId={toBranchId(dropoffLocationId)}
          />
        </div>
      </div>

      <div className="mt-(--space-xl)">
        <VehicleReviews vehicleId={vehicle.id} />
      </div>

      {similar.length > 0 && (
        <ScrollReveal className="mt-(--space-xl) flex flex-col gap-(--space-md)" delay={0.2}>
          <h2 className="font-heading text-2xl font-bold text-foreground">{t("vehicle.similar")}</h2>
          <div className="grid grid-cols-1 gap-(--space-sm) sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((v) => (
              <VehicleCard key={v.id} vehicle={v} />
            ))}
          </div>
        </ScrollReveal>
      )}
    </div>
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
