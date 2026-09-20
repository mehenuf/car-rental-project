"use client";

import { useEffect, useRef } from "react";
import { Link } from "@/lib/i18n/link";
import { Heart } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { VehicleImage } from "@/components/site/vehicle-image";
import { useFavorites } from "@/hooks/use-favorites";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { VehicleCardData } from "@/lib/queries";
import { useLocale, useT } from "@/lib/i18n/provider";

/** Maximum tilt in degrees: a hint of depth, not a gimmick. */
const MAX_TILT_DEG = 6;

export function VehicleCard({ vehicle, searchQuery }: { vehicle: VehicleCardData; searchQuery?: string }) {
  const t = useT();
  const locale = useLocale();
  const href = `/cars/${vehicle.slug}${searchQuery ? `?${searchQuery}` : ""}`;
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorited = isFavorite(vehicle.id);
  const soldOut = !vehicle.available || vehicle.stock <= 0;
  const cardRef = useRef<HTMLDivElement>(null);

  // A slight 3D tilt that follows the mouse, driven by CSS variables so it costs no animation library. It only runs
  // for mouse users who have not asked for reduced motion.
  useEffect(() => {
    const card = cardRef.current;
    if (!card || !window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    const onMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty("--ry", `${px * MAX_TILT_DEG * 2}deg`);
      card.style.setProperty("--rx", `${-py * MAX_TILT_DEG * 2}deg`);
      card.style.setProperty("--lift", "12px");
    };
    const onLeave = () => {
      card.style.setProperty("--ry", "0deg");
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--lift", "0px");
    };
    card.addEventListener("mousemove", onMove);
    card.addEventListener("mouseleave", onLeave);
    return () => {
      card.removeEventListener("mousemove", onMove);
      card.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <Card
      ref={cardRef}
      className="group animate-in fade-in slide-in-from-bottom-3 gap-0 overflow-hidden p-0 shadow-card ring-0 duration-500 [transform-style:preserve-3d] [transform:perspective(800px)_rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))_translateZ(var(--lift,0px))] transition-[transform,box-shadow] hover:shadow-xl"
    >
      <div className="flex items-center justify-between gap-2 px-(--space-sm) pt-(--space-sm)">
        <span className="truncate font-heading text-sm font-semibold text-foreground">
          {vehicle.name}
        </span>
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
          {formatCurrency(vehicle.price_per_day, locale)}
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
