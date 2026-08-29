"use client";

import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronDown } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiData } from "@/hooks/use-api-data";
import { toApiDate, type DateRange } from "@/lib/date-range";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CountrySales {
  country: string;
  country_code: string;
  sales_count: number;
  revenue: number;
}

interface DashboardStats {
  revenueChangePercent: number | null;
}

export function SalesByCountryPanel({
  range,
  refreshKey,
}: {
  range: DateRange;
  refreshKey: number;
}) {
  const countryUrl = `/api/sales-by-country?startDate=${toApiDate(range.from)}&endDate=${toApiDate(range.to)}&_r=${refreshKey}`;
  const { data, isLoading, error } = useApiData<CountrySales[]>(countryUrl);

  const statsUrl = `/api/stats?startDate=${toApiDate(range.from)}&endDate=${toApiDate(range.to)}&_r=${refreshKey}`;
  const { data: stats } = useApiData<DashboardStats>(statsUrl);

  const rows = useMemo(() => {
    const list = data ?? [];
    const total = list.reduce((sum, row) => sum + row.sales_count, 0) || 1;
    return list.slice(0, 6).map((row) => ({ ...row, percent: (row.sales_count / total) * 100 }));
  }, [data]);

  return (
    <Card className="shadow-card ring-0">
      <CardHeader>
        <CardTitle>Sales by Countries</CardTitle>
        <CardAction>
          {/* Visual only, matching the reference image's period chip — the
              data itself already follows the date range picker above. */}
          <div className="flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-1 text-sm text-muted-foreground select-none">
            This Week
            <ChevronDown className="size-3.5" />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-(--space-sm)">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {isLoading || !data
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-10" />
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            ))
          : rows.length === 0
            ? <p className="py-6 text-center text-sm text-muted-foreground">No sales yet.</p>
            : rows.map((row) => (
                <div key={row.country_code} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{row.country}</span>
                    <span className="text-muted-foreground">
                      {formatNumber(row.sales_count)} Sales
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.max(row.percent, 2)}%` }}
                    />
                  </div>
                </div>
              ))}

        {stats && <ChangeLine value={stats.revenueChangePercent} />}
      </CardContent>
    </Card>
  );
}

function ChangeLine({ value }: { value: number | null }) {
  if (value === null) return null;

  const isUp = value >= 0;
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;

  return (
    <p className="flex items-center gap-1 border-t border-border pt-(--space-2xs) text-sm">
      <span
        className={cn(
          "flex items-center gap-0.5 font-medium",
          isUp ? "text-success" : "text-destructive"
        )}
      >
        <Icon className="size-4" />
        {Math.abs(value).toFixed(0)}%
      </span>
      <span className="text-muted-foreground">
        {isUp ? "increase" : "decrease"} compare to previous period
      </span>
    </p>
  );
}
