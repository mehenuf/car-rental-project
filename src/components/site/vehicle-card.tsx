"use client";

import { useRef } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { VehicleImage } from "@/components/site/vehicle-image";
import { useFavorites } from "@/hooks/use-favorites";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { VehicleCardData } from "@/lib/queries";

gsap.registerPlugin(useGSAP);

/** Maximum tilt in degrees — kept small (a premium hint of depth, not a
 * gimmick) and applied via GSAP's quickTo so continuous pointer-move
 * values never touch React state or trigger a re-render. */
const MAX_TILT_DEG = 6;

export function VehicleCard({ vehicle }: { vehicle: VehicleCardData }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorited = isFavorite(vehicle.id);
  const soldOut = !vehicle.available || vehicle.stock <= 0;
  const cardRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const card = cardRef.current;
      if (!card || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      // transformPerspective is self-contained on the element (unlike CSS
      // `perspective`, which has to live on the parent) — exactly what's
      // needed here since VehicleCard doesn't control its grid parent.
      gsap.set(card, { transformPerspective: 800 });

      const rotateX = gsap.quickTo(card, "rotateX", { duration: 0.4, ease: "power3.out" });
      const rotateY = gsap.quickTo(card, "rotateY", { duration: 0.4, ease: "power3.out" });
      const lift = gsap.quickTo(card, "z", { duration: 0.4, ease: "power3.out" });

      // Mouse events, not pointer events: this is a hover-only effect with
      // no sensible touch equivalent (there's no sustained "position" to
      // tilt against on tap), so scoping to mouse-like devices is also the
      // semantically correct choice, not just the more reliable one.
      function handleMouseMove(e: MouseEvent) {
        const rect = card!.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        rotateY(px * MAX_TILT_DEG * 2);
        rotateX(-py * MAX_TILT_DEG * 2);
      }

      function handleMouseLeave() {
        rotateX(0);
        rotateY(0);
        lift(0);
      }

      function handleMouseEnter() {
        lift(12);
      }

      card.addEventListener("mousemove", handleMouseMove);
      card.addEventListener("mouseenter", handleMouseEnter);
      card.addEventListener("mouseleave", handleMouseLeave);
      return () => {
        card.removeEventListener("mousemove", handleMouseMove);
        card.removeEventListener("mouseenter", handleMouseEnter);
        card.removeEventListener("mouseleave", handleMouseLeave);
      };
    },
    { scope: cardRef }
  );

  return (
    <Card
      ref={cardRef}
      className="group animate-in fade-in slide-in-from-bottom-3 gap-0 overflow-hidden p-0 shadow-card ring-0 duration-500 [transform-style:preserve-3d] [will-change:transform] hover:shadow-xl"
    >
      <div className="flex items-center justify-between gap-2 px-(--space-sm) pt-(--space-sm)">
        <span className="truncate font-heading text-sm font-semibold text-foreground">
          {vehicle.name}
        </span>
        <button
          type="button"
          onClick={() => toggleFavorite(vehicle.id)}
          aria-label={
            favorited ? `Remove ${vehicle.name} from favorites` : `Add ${vehicle.name} to favorites`
          }
          aria-pressed={favorited}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-destructive"
        >
          <Heart className={cn("size-4", favorited && "fill-destructive text-destructive")} />
        </button>
      </div>

      <Link
        href={`/cars/${vehicle.slug}`}
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
          <Badge variant="outline" className="absolute top-2 left-2 border-0 bg-card/90 text-foreground">
            Sold Out
          </Badge>
        )}
      </Link>

      <div data-chat-avoid className="flex items-center justify-between gap-2 p-(--space-sm)">
        <span className="font-heading text-lg font-bold text-foreground">
          {formatCurrency(vehicle.price_per_day)}
          <span className="text-sm font-normal text-muted-foreground">/day</span>
        </span>
        {soldOut ? (
          <span className={buttonVariants({ size: "sm", variant: "outline", className: "pointer-events-none opacity-60" })}>
            Sold Out
          </span>
        ) : (
          <Link href={`/cars/${vehicle.slug}`} className={buttonVariants({ size: "sm" })}>
            Rent Now
          </Link>
        )}
      </div>
    </Card>
  );
}
