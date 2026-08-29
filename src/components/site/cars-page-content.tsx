"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { LabeledSelectValue } from "@/components/labeled-select-value";
import { Skeleton } from "@/components/ui/skeleton";
import { VehicleCard } from "@/components/site/vehicle-card";
import {
  CarsFilterSidebar,
  PRICE_MAX,
  PRICE_MIN,
  type CarsFilters,
} from "@/components/site/cars-filter-sidebar";
import { Pagination } from "@/components/site/pagination";
import { useApiData } from "@/hooks/use-api-data";
import { formatDate } from "@/lib/format";
import type { Fuel, Tables, Transmission, VehicleCategory } from "@/types/database";

interface VehiclesResponse {
  data: Tables<"vehicles">[];
  count: number;
}

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: "price_per_day:asc", label: "Price: Low to High" },
  { value: "price_per_day:desc", label: "Price: High to Low" },
  { value: "rating:desc", label: "Highest Rated" },
  { value: "created_at:desc", label: "Newest" },
];

interface ParsedFilters extends CarsFilters {
  sortBy: string;
  sortOrder: string;
  page: number;
  locationId: number | null;
}

function parseFilters(params: URLSearchParams): ParsedFilters {
  const categoryParam = params.get("category");
  const categories = categoryParam
    ? (categoryParam.split(",").filter(Boolean) as VehicleCategory[])
    : [];
  const minPrice = params.get("minPrice") ? Number(params.get("minPrice")) : PRICE_MIN;
  const maxPrice = params.get("maxPrice") ? Number(params.get("maxPrice")) : PRICE_MAX;
  const seats = params.get("seats") ? Number(params.get("seats")) : null;
  const transmission = (params.get("transmission") as Transmission | null) ?? null;
  const fuel = (params.get("fuel") as Fuel | null) ?? null;
  const [sortBy, sortOrder] = (params.get("sort") ?? "created_at:desc").split(":");
  const page = params.get("page") ? Math.max(1, Number(params.get("page"))) : 1;
  const locationId = params.get("pickupLocationId") ? Number(params.get("pickupLocationId")) : null;

  return { categories, minPrice, maxPrice, seats, transmission, fuel, sortBy, sortOrder, page, locationId };
}

export function CarsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filters = parseFilters(searchParams);

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

  function handleClearFilters() {
    router.replace(pathname, { scroll: false });
  }

  const apiParams = new URLSearchParams();
  if (filters.categories.length > 0) apiParams.set("category", filters.categories.join(","));
  if (filters.minPrice > PRICE_MIN) apiParams.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice < PRICE_MAX) apiParams.set("maxPrice", String(filters.maxPrice));
  if (filters.seats) apiParams.set("seats", String(filters.seats));
  if (filters.transmission) apiParams.set("transmission", filters.transmission);
  if (filters.fuel) apiParams.set("fuel", filters.fuel);
  if (filters.locationId) apiParams.set("locationId", String(filters.locationId));
  apiParams.set("sortBy", filters.sortBy);
  apiParams.set("sortOrder", filters.sortOrder);
  apiParams.set("page", String(filters.page));
  apiParams.set("pageSize", String(PAGE_SIZE));

  const { data, isLoading, error } = useApiData<VehiclesResponse>(
    `/api/vehicles?${apiParams.toString()}`
  );
  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));

  const pickupDate = searchParams.get("pickupDate");
  const dropoffDate = searchParams.get("dropoffDate");

  const filterSidebarProps = {
    filters,
    onCategoryToggle: handleCategoryToggle,
    onPriceCommit: handlePriceCommit,
    onSeatsChange: (seats: number | null) => updateParams({ seats: seats ? String(seats) : null }),
    onTransmissionChange: (transmission: Transmission | null) => updateParams({ transmission }),
    onFuelChange: (fuel: Fuel | null) => updateParams({ fuel }),
    onClear: handleClearFilters,
  };

  return (
    <div className="mx-auto max-w-7xl px-(--space-sm) py-(--space-lg)">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
          Browse Our Fleet
        </h1>
        {pickupDate && dropoffDate && (
          <p className="text-sm text-muted-foreground">
            Showing cars for pick-up on {formatDate(pickupDate)} through drop-off on{" "}
            {formatDate(dropoffDate)}.
          </p>
        )}
      </div>

      <div className="mt-(--space-md) grid grid-cols-1 gap-(--space-lg) lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">
          <CarsFilterSidebar {...filterSidebarProps} />
        </aside>

        <div className="flex min-w-0 flex-col gap-(--space-md)">
          <div className="flex items-center justify-between gap-(--space-sm)">
            <Button
              type="button"
              variant="outline"
              className="gap-2 lg:hidden"
              onClick={() => setMobileFiltersOpen(true)}
            >
              <SlidersHorizontal className="size-4" /> Filters
            </Button>

            <span className="hidden text-sm text-muted-foreground sm:inline">
              {data ? `${data.count} car${data.count === 1 ? "" : "s"} found` : ""}
            </span>

            <Select
              value={`${filters.sortBy}:${filters.sortOrder}`}
              onValueChange={(value) => updateParams({ sort: value })}
            >
              <SelectTrigger className="ml-auto w-52">
                <LabeledSelectValue options={SORT_OPTIONS} />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {isLoading ? (
            <div className="grid grid-cols-1 gap-(--space-sm) sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/5] w-full rounded-xl" />
              ))}
            </div>
          ) : data && data.data.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-(--space-xl) text-center">
              <p className="font-heading text-lg font-semibold text-foreground">
                No cars match your filters
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Try widening your price range or clearing a few filters to see more results.
              </p>
              <Button type="button" variant="outline" onClick={handleClearFilters}>
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-(--space-sm) sm:grid-cols-2 xl:grid-cols-3">
              {data?.data.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} />)}
            </div>
          )}

          {data && data.data.length > 0 && (
            <Pagination
              page={filters.page}
              totalPages={totalPages}
              onPageChange={(p) => updateParams({ page: String(p) }, false)}
            />
          )}
        </div>
      </div>

      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            <CarsFilterSidebar {...filterSidebarProps} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
