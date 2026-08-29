"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiData } from "@/hooks/use-api-data";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

/** Green ≥70, amber 40-69, grey below 40. Shared with the /admin/leads page. */
export function leadScoreBadgeClass(score: number): string {
  if (score >= 70) return "border-success/30 bg-success/10 text-success";
  if (score >= 40) return "border-warning/30 bg-warning/10 text-warning";
  return "border-border bg-muted text-muted-foreground";
}

export const URGENCY_LABEL: Record<string, string> = {
  immediate: "Right away",
  this_week: "This week",
  browsing: "Just browsing",
  unknown: "Unknown",
};

interface LeadsResponse {
  data: Tables<"leads">[];
  count: number;
}

export function LeadQualityPanel({ refreshKey }: { refreshKey: number }) {
  const { data, isLoading, error } = useApiData<LeadsResponse>(
    `/api/leads?page=1&pageSize=5&_r=${refreshKey}`
  );

  return (
    <Card className="shadow-card ring-0">
      <CardHeader>
        <CardTitle>Lead Quality</CardTitle>
        <CardAction>
          <Link href="/admin/leads" className={buttonVariants({ variant: "outline", size: "sm" })}>
            View All
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-(--space-sm)">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {isLoading || !data
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))
          : data.data.length === 0
            ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No scored conversations yet.
                </p>
              )
            : data.data.map((lead) => (
                <div
                  key={lead.id}
                  className="flex flex-col gap-1 border-b border-border pb-(--space-xs) last:border-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className={cn(leadScoreBadgeClass(lead.score))}>
                      {lead.score}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {URGENCY_LABEL[lead.urgency ?? "unknown"] ?? "Unknown"}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{lead.intent_summary ?? "—"}</p>
                  {lead.next_action && (
                    <p className="text-xs text-muted-foreground">Next: {lead.next_action}</p>
                  )}
                </div>
              ))}
      </CardContent>
    </Card>
  );
}
