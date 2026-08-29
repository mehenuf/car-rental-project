"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useFavorites } from "@/hooks/use-favorites";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

export function VehicleCard({ vehicle }: { vehicle: Tables<"vehicles"> }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorited = isFavorite(vehicle.id);

  return (
    <Card className="group gap-0 overflow-hidden p-0 shadow-card ring-0 transition-shadow hover:shadow-lg">
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
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-destructive"
        >
          <Heart className={cn("size-4", favorited && "fill-destructive text-destructive")} />
        </button>
      </div>

      <Link
        href={`/cars/${vehicle.slug}`}
        className="relative mt-(--space-xs) block aspect-[4/3] w-full overflow-hidden bg-muted"
      >
        <Image
          src={vehicle.image_url}
          alt={vehicle.name}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </Link>

      <div className="flex items-center justify-between gap-2 p-(--space-sm)">
        <span className="font-heading text-lg font-bold text-foreground">
          {formatCurrency(vehicle.price_per_day)}
          <span className="text-sm font-normal text-muted-foreground">/day</span>
        </span>
        <Link href={`/cars/${vehicle.slug}`} className={buttonVariants({ size: "sm" })}>
          Rent Now
        </Link>
      </div>
    </Card>
  );
}
