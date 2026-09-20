import { ArrowUpRight } from "lucide-react";
import { Link } from "@/lib/i18n/link";
import { ScrollReveal } from "@/components/site/scroll-reveal";
import { getT } from "@/lib/i18n/dictionary";
import type { CityTile } from "@/lib/home-data";

/**
 * Every city with cars available now, as a grid that wraps. There are at most ten, so all of them are shown at once:
 * nothing scrolls sideways and nothing is clipped. Each tile links to that city's own page. Numbers come from the
 * database.
 */
export async function CityShelf({ tiles }: { tiles: CityTile[] }) {
  if (tiles.length === 0) return null;
  const t = await getT();

  return (
    <section id="cities" aria-labelledby="cities-title" className="mx-auto max-w-7xl px-(--space-sm) py-(--space-xl)">
      <ScrollReveal className="flex flex-col gap-2">
        <h2 id="cities-title" className="font-heading text-3xl font-bold text-foreground">{t("landing.cities.title")}</h2>
        <p className="max-w-xl text-muted-foreground">{t("landing.cities.subtitle")}</p>
      </ScrollReveal>

      <ul className="mt-(--space-md) grid grid-cols-2 gap-(--space-xs) sm:grid-cols-3 lg:grid-cols-5" data-testid="city-grid">
        {tiles.map((tile) => (
          <li key={tile.slug} className="min-w-0">
            <Link
              href={`/cars/in/${tile.slug}`}
              className="group flex h-full min-h-32 flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-accent hover:bg-muted focus-visible:border-accent"
            >
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0 break-words font-heading text-xl font-bold leading-tight text-foreground">{tile.city}</span>
                <ArrowUpRight
                  className="size-4 shrink-0 text-muted-foreground transition-colors duration-200 group-hover:text-accent-text rtl:-scale-x-100"
                  aria-hidden="true"
                />
              </span>
              <span className="flex flex-col text-sm text-muted-foreground">
                <span>{tile.countryCode}</span>
                <span>{t("landing.cities.cars", { count: tile.cars })}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
