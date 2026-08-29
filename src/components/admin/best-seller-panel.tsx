"use client";

import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiData } from "@/hooks/use-api-data";
import { toApiDate, type DateRange } from "@/lib/date-range";
import { formatCurrency } from "@/lib/format";

interface BestSeller {
  id: string;
  name: string;
  brand: string;
  image_url: string;
  price_per_day: number;
  sales_count: number;
  revenue: number;
}

export function BestSellerPanel({
  range,
  refreshKey,
}: {
  range: DateRange;
  refreshKey: number;
}) {
  const url = `/api/best-sellers?startDate=${toApiDate(range.from)}&endDate=${toApiDate(range.to)}&limit=5&_r=${refreshKey}`;
  const { data, isLoading, error } = useApiData<BestSeller[]>(url);

  return (
    <Card className="shadow-card ring-0">
      <CardHeader>
        <CardTitle>Best Seller</CardTitle>
        <CardAction>
          <Link href="/admin/vehicles" className={buttonVariants({ variant: "outline", size: "sm" })}>
            View All
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-(--space-sm)">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {isLoading || !data
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-12 shrink-0 rounded-lg" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-4 w-10" />
              </div>
            ))
          : data.length === 0
            ? <p className="py-6 text-center text-sm text-muted-foreground">No sales yet.</p>
            : data.map((vehicle) => (
                <div key={vehicle.id} className="flex items-center gap-3">
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                    <Image
                      src={vehicle.image_url}
                      alt={vehicle.name}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">{vehicle.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency(vehicle.price_per_day)}
                    </span>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-xs text-muted-foreground">Sales</span>
                    <span className="text-sm font-semibold text-foreground">{vehicle.sales_count}</span>
                  </div>
                </div>
              ))}
      </CardContent>
    </Card>
  );
}
