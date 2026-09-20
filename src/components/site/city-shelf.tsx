import { ArrowUpRight } from "lucide-react";
import { Link } from "@/lib/i18n/link";
import { ScrollReveal } from "@/components/site/scroll-reveal";
import { getT } from "@/lib/i18n/dictionary";
import type { CityTile } from "@/lib/home-data";

/** Cities with cars available right now, each linking to that city's own page. Numbers come from the database. */
export async function CityShelf({ tiles }: { tiles: CityTile[] }) {
  if (tiles.length === 0) return null;
  const t = await getT();

  return (
    <section id="cities" className="mx-auto max-w-7xl px-(--space-sm) py-(--space-xl)">
      <ScrollReveal className="flex flex-col gap-2">
        <h2 className="font-heading text-3xl font-bold text-foreground">{t("landing.cities.title")}</h2>
        <p className="max-w-xl text-muted-foreground">{t("landing.cities.subtitle")}</p>
      </ScrollReveal>

      <ul
        className="no-scrollbar mt-(--space-md) flex snap-x snap-mandatory gap-(--space-xs) overflow-x-auto pb-2 [scroll-padding-inline:1rem]"
      >
        {tiles.map((tile) => (
          <li key={tile.slug} className="w-56 shrink-0 snap-start sm:w-64">
            <Link
              href={`/cars/in/${tile.slug}`}
              className="group flex h-44 flex-col justify-between rounded-2xl border border-border bg-card p-4 transition-[transform,border-color,background-color] duration-300 ease-out hover:-translate-y-1 hover:border-accent hover:bg-muted"
            >
              <span className="flex items-start justify-between gap-2">
                <span className="font-heading text-2xl font-bold leading-tight text-foreground">{tile.city}</span>
                <ArrowUpRight
                  className="size-5 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent-text rtl:-scale-x-100"
                  aria-hidden="true"
                />
              </span>
              <span className="flex flex-col text-sm text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wide">{tile.countryCode}</span>
                <span>{t("landing.cities.cars", { count: tile.cars })}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
