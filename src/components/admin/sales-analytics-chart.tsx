"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiData } from "@/hooks/use-api-data";
import { formatCurrency } from "@/lib/format";
import type { DateRange } from "@/lib/date-range";

interface MonthlySales {
  month: number;
  revenue: number;
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function yearOptions(centerYear: number): number[] {
  return [centerYear - 2, centerYear - 1, centerYear, centerYear + 1];
}

export function SalesAnalyticsChart({
  range,
  refreshKey,
}: {
  range: DateRange;
  refreshKey: number;
}) {
  const [year, setYear] = useState(() => range.to.getFullYear());

  // The date range picker drives the default year shown here; the dropdown
  // still lets the user explore a different year independently in between
  // range changes. Adjusting state during render (rather than in an
  // effect) avoids an extra render pass — see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevRange, setPrevRange] = useState(range);
  if (range !== prevRange) {
    setPrevRange(range);
    setYear(range.to.getFullYear());
  }

  const url = `/api/monthly-sales?year=${year}&_r=${refreshKey}`;
  const { data, isLoading, error } = useApiData<MonthlySales[]>(url);

  const chartData = (data ?? MONTH_LABELS.map((_, i) => ({ month: i + 1, revenue: 0 }))).map(
    (row) => ({
      monthLabel: MONTH_LABELS[row.month - 1],
      revenue: row.revenue,
    })
  );

  return (
    <Card className="shadow-card ring-0">
      <CardHeader>
        <CardTitle>Sales Analytics</CardTitle>
        <CardAction>
          <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
            <SelectTrigger size="sm" className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions(range.to.getFullYear()).map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesAnalyticsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="monthLabel"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                  tickFormatter={(value: number) =>
                    value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value)
                  }
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value ?? 0)), "Revenue"]}
                  contentStyle={{
                    backgroundColor: "var(--color-popover)",
                    borderColor: "var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    fontSize: 13,
                  }}
                  labelStyle={{ color: "var(--color-foreground)" }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  fill="url(#salesAnalyticsFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
