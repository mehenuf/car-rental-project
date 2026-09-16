import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { VehicleCard } from "@/components/site/vehicle-card";
import { CarsFilterControls } from "@/components/site/cars-filter-controls";
import { CarsMobileFiltersSheet } from "@/components/site/cars-mobile-filters-sheet";
import { CarsSortSelect } from "@/components/site/cars-sort-select";
import { CarsPaginationControl } from "@/components/site/cars-pagination-control";
import type { CarsFilters } from "@/components/site/cars-filter-sidebar";
import { getVehicleCards } from "@/lib/queries";
import { VehiclesQuerySchema, searchParamsToObject } from "@/lib/schemas";
import { formatDate } from "@/lib/format";

const PAGE_SIZE = 12;

/** A server component that reads the URL's search params directly and
 * queries the database itself (no client-fetch round trip through
 * /api/vehicles), matching the pattern already used by
 * cars/[slug]/page.tsx. Only the interactive controls (filters, sort,
 * pagination) are client islands, each independently calling
 * router.replace — the App Router's own re-render then re-runs this
 * component server-side with the new searchParams. */
export async function CarsPageContent({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }

  const query = VehiclesQuerySchema.safeParse(searchParamsToObject(params));
  const filters = query.success ? query.data : {};

  const page = filters.page ?? 1;
  const sortBy = filters.sortBy ?? "created_at";
  const sortOrder = filters.sortOrder ?? "desc";

  const { data, count } = await getVehicleCards({
    category: filters.category,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    seats: filters.seats,
    transmission: filters.transmission,
    fuel: filters.fuel,
    locationId: filters.locationId,
    sortBy,
    sortOrder,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const pickupDate = params.get("pickupDate");
  const dropoffDate = params.get("dropoffDate");

  const filterValues: CarsFilters = {
    categories: filters.category ?? [],
    minPrice: filters.minPrice ?? 0,
    maxPrice: filters.maxPrice ?? 300,
    seats: filters.seats ?? null,
    transmission: filters.transmission ?? null,
    fuel: filters.fuel ?? null,
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
          <CarsFilterControls filters={filterValues} />
        </aside>

        <div className="flex min-w-0 flex-col gap-(--space-md)">
          <div className="flex items-center justify-between gap-(--space-sm)">
            <CarsMobileFiltersSheet filters={filterValues} />

            <span className="hidden text-sm text-muted-foreground sm:inline">
              {count} car{count === 1 ? "" : "s"} found
            </span>

            <CarsSortSelect value={`${sortBy}:${sortOrder}`} />
          </div>

          {data.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-(--space-xl) text-center">
              <p className="font-heading text-lg font-semibold text-foreground">
                No cars match your filters
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Try widening your price range or clearing a few filters to see more results.
              </p>
              <Link href="/cars" className={buttonVariants({ variant: "outline" })}>
                Clear filters
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-(--space-sm) sm:grid-cols-2 xl:grid-cols-3">
              {data.map((vehicle) => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} />
              ))}
            </div>
          )}

          {data.length > 0 && <CarsPaginationControl page={page} totalPages={totalPages} />}
        </div>
      </div>
    </div>
  );
}
