"use client";

import { useState } from "react";
import { MessagesSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { leadScoreBadgeClass, URGENCY_LABEL } from "@/components/admin/lead-quality-panel";
import { useApiData } from "@/hooks/use-api-data";
import { formatTimeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

type Lead = Tables<"leads">;

interface LeadsResponse {
  data: Lead[];
  count: number;
}

const PAGE_SIZE = 20;

const BUDGET_LABEL: Record<string, string> = {
  low: "Low",
  mid: "Mid",
  high: "High",
  unknown: "Unknown",
};

export default function AdminLeadsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useApiData<LeadsResponse>(
    `/api/leads?page=${page}&pageSize=${PAGE_SIZE}`
  );

  const columns: DataTableColumn<Lead>[] = [
    {
      key: "score",
      header: "Score",
      render: (row) => (
        <Badge variant="outline" className={cn(leadScoreBadgeClass(row.score))}>
          {row.score}
        </Badge>
      ),
    },
    {
      key: "intent_summary",
      header: "Summary",
      className: "max-w-sm",
      render: (row) => <span className="text-sm text-foreground">{row.intent_summary ?? "—"}</span>,
    },
    {
      key: "budget_band",
      header: "Budget",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {BUDGET_LABEL[row.budget_band ?? "unknown"] ?? "Unknown"}
        </span>
      ),
    },
    {
      key: "urgency",
      header: "Urgency",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {URGENCY_LABEL[row.urgency ?? "unknown"] ?? "Unknown"}
        </span>
      ),
    },
    {
      key: "next_action",
      header: "Next Step",
      className: "max-w-sm",
      render: (row) => <span className="text-sm text-muted-foreground">{row.next_action ?? "—"}</span>,
    },
    {
      key: "created_at",
      header: "When",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.created_at ? formatTimeAgo(row.created_at) : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-(--space-md)">
      <h1 className="font-heading text-xl font-bold text-foreground">Leads</h1>

      <Card className="shadow-card ring-0">
        <CardHeader>
          <CardTitle>All Leads (highest score first)</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
          <DataTable
            columns={columns}
            data={data?.data ?? []}
            getRowId={(row) => row.id}
            isLoading={isLoading}
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={data?.count ?? 0}
            onPageChange={setPage}
            emptyMessage={
              <EmptyState
                icon={MessagesSquare}
                title="No leads yet"
                description="Once a visitor chats with the assistant for a few messages, their conversation gets scored and shows up here."
              />
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
