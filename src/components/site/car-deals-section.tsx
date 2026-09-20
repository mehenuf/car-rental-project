"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollReveal } from "@/components/site/scroll-reveal";
import { VehicleCard } from "@/components/site/vehicle-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { VehicleCardData } from "@/lib/queries";
import type { VehicleCategory } from "@/types/database";
import { useT } from "@/lib/i18n/provider";

const TAB_VALUES: VehicleCategory[] = ["popular", "large", "small", "exclusive"];
const TAB_KEYS: Record<VehicleCategory, string> = {
  popular: "enums.category.popular",
  large: "cars.tabLarge",
  small: "cars.tabSmall",
  exclusive: "cars.tabExclusive",
};

const PAGE_SIZE = 8;

interface VehiclesResponse {
  data: VehicleCardData[];
  count: number;
}

/** The "popular" tab (page 1) is rendered server-side by the homepage and
 * passed in as `initialVehicles`/`initialCount` — no client fetch, no
 * loading skeleton, on the by-far-most-common path (a fresh homepage
 * load). Only switching tabs or loading more pages triggers a client
 * fetch, and even then it asks for the lean `fields=card` column set. */
export function CarDealsSection({
  initialVehicles,
  initialCount,
}: {
  initialVehicles: VehicleCardData[];
  initialCount: number;
}) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<VehicleCategory>("popular");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<VehicleCardData[]>(initialVehicles);
  const [totalCount, setTotalCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInitialRender = useRef(true);

  useEffect(() => {
    // The very first render already has server-fetched data for
    // activeTab="popular"/page=1 — skip re-fetching it on mount.
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }

    let cancelled = false;

    async function run() {
      try {
        const params = new URLSearchParams({
          category: activeTab,
          page: String(page),
          pageSize: String(PAGE_SIZE),
          sortBy: "created_at",
          sortOrder: "desc",
          fields: "card",
        });
        const res = await fetch(`/api/vehicles?${params.toString()}`);
        const body = (await res.json()) as unknown;
        if (!res.ok) {
          const message =
            (body as { error?: { message?: string } })?.error?.message ?? t("cars.loadFailed");
          throw new Error(message);
        }
        if (cancelled) return;
        const result = body as VehiclesResponse;
        setTotalCount(result.count);
        setItems((prev) => (page === 1 ? result.data : [...prev, ...result.data]));
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t("cars.loadFailed"));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    // See use-api-data.ts for why this synchronous reset (rather than one
    // inside a callback) is intentional: `activeTab`/`page` is the request
    // key, so loading must flip before the first await.
    setIsLoading(true);
    run();

    return () => {
      cancelled = true;
    };
  }, [activeTab, page, t]);

  function handleTabChange(tab: VehicleCategory) {
    setActiveTab(tab);
    setPage(1);
    setItems([]);
  }

  const hasMore = items.length < totalCount;

  return (
    <section id="rental-deals" className="mx-auto max-w-7xl px-(--space-sm) py-(--space-xl)">
      <ScrollReveal className="flex flex-col items-center gap-2 text-center" delay={0.1}>
        <h2 className="font-heading text-3xl font-bold text-foreground">
          {t("cars.dealsTitle")}
        </h2>
        <p className="max-w-xl text-muted-foreground">
          {t("cars.dealsBody")}
        </p>
      </ScrollReveal>

      <div className="mt-(--space-md) flex items-center justify-center gap-6 border-b border-border">
        {TAB_VALUES.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => handleTabChange(tab)}
            className={cn(
              "relative pb-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              activeTab === tab &&
                "text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent"
            )}
          >
            {t(TAB_KEYS[tab])}
          </button>
        ))}
      </div>

      {error && <p className="mt-(--space-sm) text-center text-sm text-destructive">{error}</p>}

      <div className="mt-(--space-md) grid grid-cols-1 gap-(--space-sm) sm:grid-cols-2 lg:grid-cols-4">
        {isLoading && items.length === 0
          ? Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/5] w-full rounded-xl" />
            ))
          : items.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} />)}
      </div>

      <div className="mt-(--space-md) flex flex-col items-center justify-center gap-3 sm:flex-row sm:justify-between">
        <div className="hidden sm:block sm:w-32" aria-hidden />
        <Button
          type="button"
          variant="outline"
          disabled={!hasMore || isLoading}
          onClick={() => setPage((p) => p + 1)}
        >
          {isLoading && page > 1 ? t("cars.loading") : hasMore ? t("cars.showMore") : t("cars.noMore")}
        </Button>
        <span className="w-32 text-center text-sm text-muted-foreground sm:text-end">
          {t("cars.total", { count: totalCount })}
        </span>
      </div>
    </section>
  );
}
