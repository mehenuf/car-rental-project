"use client";

import { useCallback, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/admin/date-range-picker";
import { DashboardStatCards } from "@/components/admin/dashboard-stat-cards";
import { BestSellerPanel } from "@/components/admin/best-seller-panel";
import { RecentTransactionsPanel } from "@/components/admin/recent-transactions-panel";
import { SalesAnalyticsChart } from "@/components/admin/sales-analytics-chart";
import { SalesByCountryPanel } from "@/components/admin/sales-by-country-panel";
import { LeadQualityPanel } from "@/components/admin/lead-quality-panel";
import { defaultDateRange, type DateRange } from "@/lib/date-range";
import { useSupabaseUser } from "@/hooks/use-supabase-user";

export default function AdminDashboardPage() {
  const [range, setRange] = useState<DateRange>(() => defaultDateRange());
  const [refreshKey, setRefreshKey] = useState(0);
  const { user } = useSupabaseUser();

  const handleRefresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  const fullName = user?.user_metadata?.full_name as string | undefined;
  const firstName = fullName?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="flex flex-col gap-(--space-sm) sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-medium text-foreground sm:text-xl">
          <span aria-hidden>👋</span> Hi {firstName},{" "}
          <span className="font-normal text-muted-foreground">
            here&apos;s what&apos;s happening with your store today.
          </span>
        </h1>

        <div className="flex items-center gap-2">
          <DateRangePicker value={range} onChange={setRange} />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            aria-label="Refresh dashboard"
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>

      <DashboardStatCards range={range} refreshKey={refreshKey} />

      <div className="grid grid-cols-1 gap-(--space-md) xl:grid-cols-[1fr_1.6fr]">
        <BestSellerPanel range={range} refreshKey={refreshKey} />
        <RecentTransactionsPanel range={range} refreshKey={refreshKey} />
      </div>

      <div className="grid grid-cols-1 gap-(--space-md) xl:grid-cols-[1.6fr_1fr]">
        <SalesAnalyticsChart range={range} refreshKey={refreshKey} />
        <SalesByCountryPanel range={range} refreshKey={refreshKey} />
      </div>

      <LeadQualityPanel refreshKey={refreshKey} />
    </div>
  );
}
