"use client";

import { useEffect, useState } from "react";
import { VehicleCard } from "@/components/site/vehicle-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Tables, VehicleCategory } from "@/types/database";

const TABS: { label: string; value: VehicleCategory }[] = [
  { label: "Popular", value: "popular" },
  { label: "Large Car", value: "large" },
  { label: "Small Car", value: "small" },
  { label: "Exclusive Car", value: "exclusive" },
];

const PAGE_SIZE = 8;

interface VehiclesResponse {
  data: Tables<"vehicles">[];
  count: number;
}

export function CarDealsSection() {
  const [activeTab, setActiveTab] = useState<VehicleCategory>("popular");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Tables<"vehicles">[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const params = new URLSearchParams({
          category: activeTab,
          page: String(page),
          pageSize: String(PAGE_SIZE),
          sortBy: "created_at",
          sortOrder: "desc",
        });
        const res = await fetch(`/api/vehicles?${params.toString()}`);
        const body = (await res.json()) as unknown;
        if (!res.ok) {
          const message =
            (body as { error?: { message?: string } })?.error?.message ?? "Failed to load vehicles";
          throw new Error(message);
        }
        if (cancelled) return;
        const result = body as VehiclesResponse;
        setTotalCount(result.count);
        setItems((prev) => (page === 1 ? result.data : [...prev, ...result.data]));
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load vehicles");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    // See use-api-data.ts for why this synchronous reset (rather than one
    // inside a callback) is intentional: `activeTab`/`page` is the request
    // key, so loading must flip before the first await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    run();

    return () => {
      cancelled = true;
    };
  }, [activeTab, page]);

  function handleTabChange(tab: VehicleCategory) {
    setActiveTab(tab);
    setPage(1);
    setItems([]);
  }

  const hasMore = items.length < totalCount;

  return (
    <section id="rental-deals" className="mx-auto max-w-7xl px-(--space-sm) py-(--space-xl)">
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="font-heading text-3xl font-bold text-foreground">
          Most Popular Car Rental Deals
        </h2>
        <p className="max-w-xl text-muted-foreground">
          A high-performing, well-maintained fleet ready to book for any trip — short or long.
        </p>
      </div>

      <div className="mt-(--space-md) flex items-center justify-center gap-6 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => handleTabChange(tab.value)}
            className={cn(
              "relative pb-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              activeTab === tab.value &&
                "text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent"
            )}
          >
            {tab.label}
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
          {isLoading && page > 1 ? "Loading..." : hasMore ? "Show more car" : "No more cars"}
        </Button>
        <span className="w-32 text-center text-sm text-muted-foreground sm:text-right">
          {totalCount} {totalCount === 1 ? "Car" : "Cars"}
        </span>
      </div>
    </section>
  );
}
