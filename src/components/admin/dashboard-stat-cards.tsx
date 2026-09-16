"use client";

import { ArrowDownRight, ArrowUpRight, PiggyBank, ShoppingBag, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiData } from "@/hooks/use-api-data";
import { toApiDate, type DateRange } from "@/lib/date-range";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface DashboardStats {
  totalRevenue: number;
  salesCount: number;
  purchaseCount: number;
  revenueChangePercent: number | null;
}

export function DashboardStatCards({
  range,
  refreshKey,
}: {
  range: DateRange;
  refreshKey: number;
}) {
  const url = `/api/stats?startDate=${toApiDate(range.from)}&endDate=${toApiDate(range.to)}&_r=${refreshKey}`;
  const result = useApiData<DashboardStats>(url);

  return (
    <div className="flex flex-col gap-(--space-2xs)">
      <div className="grid grid-cols-1 gap-(--space-sm) sm:grid-cols-3">
        <Card className="justify-center p-(--space-sm) shadow-card ring-0">
          <CardContent className="flex items-center justify-between gap-(--space-sm) px-0">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-accent-text">Total Earning</span>
              {result.status === "loading" ? (
                <Skeleton className="h-8 w-32" />
              ) : result.status === "error" ? (
                <span className="text-2xl font-bold text-muted-foreground">—</span>
              ) : (
                <span className="font-heading text-2xl font-bold text-foreground">
                  {formatCurrency(result.data.totalRevenue)}
                </span>
              )}
              {result.status === "loading" ? (
                <Skeleton className="h-4 w-44" />
              ) : result.status === "success" ? (
                <ChangeIndicator value={result.data.revenueChangePercent} />
              ) : null}
            </div>
            <PiggyBank className="size-14 shrink-0 text-accent-text/25" aria-hidden />
          </CardContent>
        </Card>

        <Card className="justify-center border-0 bg-accent p-(--space-sm) text-accent-foreground shadow-card">
          <CardContent className="flex items-center justify-between gap-(--space-sm) px-0">
            <div className="flex flex-col gap-2">
              {result.status === "loading" ? (
                <Skeleton className="h-8 w-24 bg-white/25" />
              ) : result.status === "error" ? (
                <span className="text-2xl font-bold text-accent-foreground/50">—</span>
              ) : (
                <span className="font-heading text-2xl font-bold">
                  {formatNumber(result.data.salesCount)}
                </span>
              )}
              <span className="text-sm text-accent-foreground/85">No of Total Sales</span>
            </div>
            <ShoppingBag className="size-10 shrink-0 text-accent-foreground/40" aria-hidden />
          </CardContent>
        </Card>

        <Card className="justify-center border-0 bg-primary p-(--space-sm) text-primary-foreground shadow-card">
          <CardContent className="flex items-center justify-between gap-(--space-sm) px-0">
            <div className="flex flex-col gap-2">
              {result.status === "loading" ? (
                <Skeleton className="h-8 w-24 bg-white/20" />
              ) : result.status === "error" ? (
                <span className="text-2xl font-bold text-primary-foreground/50">—</span>
              ) : (
                <span className="font-heading text-2xl font-bold">
                  {formatNumber(result.data.purchaseCount)}
                </span>
              )}
              <span className="text-sm text-primary-foreground/75">No of Purchased Goods</span>
            </div>
            <Wallet className="size-10 shrink-0 text-primary-foreground/40" aria-hidden />
          </CardContent>
        </Card>
      </div>

      {result.status === "error" && <p className="text-sm text-destructive">{result.error}</p>}
    </div>
  );
}

function ChangeIndicator({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-xs text-muted-foreground">No data for the previous period</span>;
  }

  const isUp = value >= 0;
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;

  return (
    <span className="flex flex-wrap items-center gap-1 text-xs">
      <span
        className={cn(
          "flex items-center gap-0.5 font-medium",
          isUp ? "text-success-text" : "text-destructive"
        )}
      >
        <Icon className="size-3.5" />
        {Math.abs(value).toFixed(0)}%
      </span>
      <span className="text-muted-foreground">
        {isUp ? "increase" : "decrease"} vs. previous period
      </span>
    </span>
  );
}
