"use client";

import { useState } from "react";
import { ProviderReviewDialog } from "@/components/admin/provider-review-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiData } from "@/hooks/use-api-data";
import { formatDate } from "@/lib/format";

interface Row {
  id: string;
  type: "company" | "individual";
  display_name: string;
  country_code: string;
  status: string;
  submitted_at: string | null;
  pending_documents: number;
  cars_pending_review: number;
}

const FILTERS = [
  { value: "", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "suspended", label: "Suspended" },
  { value: "draft", label: "Draft" },
];

export default function AdminProvidersPage() {
  const [status, setStatus] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const result = useApiData<{ data: Row[] }>(`/api/admin/providers?status=${status}&_r=${refresh}`);
  const rows = result.status === "success" ? result.data.data : [];

  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">Providers</h1>
        <p className="text-sm text-muted-foreground">Review applications, documents and private owners&apos; cars.</p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={status === f.value}
            onClick={() => setStatus(f.value)}
            className={`rounded-full border px-3 py-1 text-sm ${status === f.value ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card className="shadow-card ring-0">
        <CardContent className="p-0">
          {result.status === "error" && <p className="p-(--space-sm) text-sm text-destructive">{result.error}</p>}
          {result.status === "loading" && <p className="p-(--space-sm) text-sm text-muted-foreground">Loading...</p>}
          {result.status === "success" && rows.length === 0 && (
            <p className="p-(--space-sm) text-sm text-muted-foreground">No providers match this filter.</p>
          )}
          {rows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">To review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} className="cursor-pointer" onClick={() => setSelected(row.id)}>
                    <TableCell className="font-medium">
                      <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => setSelected(row.id)}>
                        {row.display_name}
                      </button>
                    </TableCell>
                    <TableCell className="capitalize">{row.type}</TableCell>
                    <TableCell>{row.country_code}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{row.status.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell>{row.submitted_at ? formatDate(row.submitted_at) : "-"}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {row.pending_documents} docs, {row.cars_pending_review} cars
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ProviderReviewDialog providerId={selected} onClose={() => setSelected(null)} onChanged={() => setRefresh((n) => n + 1)} />
    </div>
  );
}
