"use client";

import { Link } from "@/lib/i18n/link";
import { Heart, MapPin, Star } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { VehicleImage } from "@/components/site/vehicle-image";
import { useFavorites } from "@/hooks/use-favorites";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { formatMinor } from "@/lib/pricing/money";
import { numberingLocale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";
import type { VehicleCardData } from "@/lib/queries";
import { useLocale, useT } from "@/lib/i18n/provider";

export function VehicleCard({ vehicle, searchQuery }: { vehicle: VehicleCardData; searchQuery?: string }) {
  const t = useT();
  const locale = useLocale();
  const href = `/cars/${vehicle.slug}${searchQuery ? `?${searchQuery}` : ""}`;
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorited = isFavorite(vehicle.id);
  const soldOut = !vehicle.available || vehicle.stock <= 0;

  return (
    <Card
      className="group animate-in fade-in gap-0 overflow-hidden p-0 shadow-card ring-0 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="flex items-center justify-between gap-2 px-(--space-sm) pt-(--space-sm)">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-heading text-sm font-semibold text-foreground">{vehicle.name}</span>
          {(vehicle.place || vehicle.review_count > 0) && (
            <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              {vehicle.place && (
                <span className="flex min-w-0 items-center gap-1">
                  <MapPin className="size-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {vehicle.place.city}
                    {vehicle.place.otherCities > 0 ? ` +${vehicle.place.otherCities}` : ""}
                  </span>
                </span>
              )}
              {vehicle.review_count > 0 && (
                <span className="flex shrink-0 items-center gap-1" role="img" aria-label={t("testimonials.rated", { rating: Number(vehicle.rating).toFixed(1) })}>
                  <Star className="size-3 fill-current text-accent-text" aria-hidden="true" />
                  {Number(vehicle.rating).toFixed(1)}
                </span>
              )}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => toggleFavorite(vehicle.id)}
          aria-label={
            favorited
              ? t("vehicle.removeFavorite", { name: vehicle.name })
              : t("vehicle.addFavorite", { name: vehicle.name })
          }
          aria-pressed={favorited}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-destructive"
        >
          <Heart className={cn("size-4", favorited && "fill-destructive text-destructive")} />
        </button>
      </div>

      <Link
        href={href}
        className="relative mt-(--space-xs) block aspect-[4/3] w-full overflow-hidden bg-muted"
      >
        <VehicleImage
          src={vehicle.image_url}
          alt={vehicle.name}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {soldOut && (
          <Badge variant="outline" className="absolute top-2 start-2 border-0 bg-card/90 text-foreground">
            {t("vehicle.soldOut")}
          </Badge>
        )}
      </Link>

      <div data-chat-avoid className="flex items-center justify-between gap-2 p-(--space-sm)">
        <span className="font-heading text-lg font-bold text-foreground">
          {vehicle.place ? formatMinor(vehicle.place.dailyMinor, vehicle.place.currency, numberingLocale(locale)) : formatCurrency(vehicle.price_per_day, locale)}
          <span className="text-sm font-normal text-muted-foreground">{t("vehicle.perDay")}</span>
        </span>
        {soldOut ? (
          <span className={buttonVariants({ size: "sm", variant: "outline", className: "pointer-events-none opacity-60" })}>
            {t("vehicle.soldOut")}
          </span>
        ) : (
          <Link href={href} className={buttonVariants({ size: "sm" })}>
            {t("vehicle.rentNow")}
          </Link>
        )}
      </div>
    </Card>
  );
}
