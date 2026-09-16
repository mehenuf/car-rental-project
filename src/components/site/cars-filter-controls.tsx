"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CarsFilterSidebar,
  PRICE_MAX,
  PRICE_MIN,
  type CarsFilters,
} from "@/components/site/cars-filter-sidebar";
import type { Fuel, Transmission, VehicleCategory } from "@/types/database";

/** The interactive half of the /cars filter sidebar — owns the
 * URL-updating logic so the page itself can stay a server component that
 * reads searchParams and fetches directly, per DESIGN.md's data-fetching
 * pattern. Mounted twice (desktop aside + mobile sheet), matching the
 * previous single-client-parent version, which fed both with the same
 * callback set from one place. */
export function CarsFilterControls({ filters }: { filters: CarsFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParams(updates: Record<string, string | null>, resetPage = true) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    if (resetPage) params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function handleCategoryToggle(category: VehicleCategory, checked: boolean) {
    const next = checked
      ? [...filters.categories, category]
      : filters.categories.filter((c) => c !== category);
    updateParams({ category: next.length > 0 ? next.join(",") : null });
  }

  function handlePriceCommit([min, max]: [number, number]) {
    updateParams({
      minPrice: min > PRICE_MIN ? String(min) : null,
      maxPrice: max < PRICE_MAX ? String(max) : null,
    });
  }

  return (
    <CarsFilterSidebar
      filters={filters}
      onCategoryToggle={handleCategoryToggle}
      onPriceCommit={handlePriceCommit}
      onSeatsChange={(seats: number | null) => updateParams({ seats: seats ? String(seats) : null })}
      onTransmissionChange={(transmission: Transmission | null) => updateParams({ transmission })}
      onFuelChange={(fuel: Fuel | null) => updateParams({ fuel })}
      onClear={() => router.replace(pathname, { scroll: false })}
    />
  );
}
