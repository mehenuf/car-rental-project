"use client";

import { useState } from "react";
import { VehicleImage } from "@/components/site/vehicle-image";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { BookingStatusBadge } from "@/components/admin/booking-status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { LabeledSelectValue } from "@/components/labeled-select-value";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiData } from "@/hooks/use-api-data";
import { toApiDate, type DateRange } from "@/lib/date-range";
import { formatCurrency, formatTimeAgo } from "@/lib/format";
import type { BookingStatus } from "@/types/database";

interface TransactionRow {
  id: string;
  reference: string;
  payment_method: string | null;
  status: BookingStatus;
  total_amount: number;
  created_at: string | null;
  vehicle: { name: string; image_url: string } | null;
}

interface TransactionsResponse {
  data: TransactionRow[];
  count: number;
}

const PAGE_SIZE = 5;
type SortBy = "created_at" | "total_amount" | "pickup_at";

export function RecentTransactionsPanel({
  range,
  refreshKey,
}: {
  range: DateRange;
  refreshKey: number;
}) {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortBy>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [status, setStatus] = useState<BookingStatus | "all">("all");

  const params = new URLSearchParams({
    startDate: toApiDate(range.from),
    endDate: toApiDate(range.to),
    sortBy,
    sortOrder,
    page: String(page),
    pageSize: String(PAGE_SIZE),
    _r: String(refreshKey),
  });
  if (status !== "all") params.set("status", status);

  const { data, isLoading, error } = useApiData<TransactionsResponse>(
    `/api/bookings?${params.toString()}`
  );

  function handleSortChange(key: string) {
    if (key === sortBy) {
      setSortOrder((order) => (order === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key as SortBy);
      setSortOrder("desc");
    }
    setPage(1);
  }

  const columns: DataTableColumn<TransactionRow>[] = [
    {
      key: "#",
      header: "#",
      render: (_row, index) => (
        <span className="text-muted-foreground">{(page - 1) * PAGE_SIZE + index + 1}</span>
      ),
    },
    {
      key: "created_at",
      header: "Order Details",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="relative size-9 shrink-0 overflow-hidden rounded-md bg-muted">
            {row.vehicle?.image_url && (
              <VehicleImage
                src={row.vehicle.image_url}
                alt={row.vehicle.name}
                fill
                sizes="36px"
                className="object-cover"
              />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">
              {row.vehicle?.name ?? "—"}
            </span>
            <span className="text-xs text-muted-foreground">
              {row.created_at ? formatTimeAgo(row.created_at) : "—"}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "payment_method",
      header: "Payment",
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-sm text-foreground capitalize">
            {row.payment_method?.replace("_", " ") ?? "—"}
          </span>
          <span className="text-xs text-accent">#{row.reference}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <BookingStatusBadge status={row.status} />,
    },
    {
      key: "total_amount",
      header: "Amount",
      sortable: true,
      align: "right",
      render: (row) => (
        <span className="font-medium text-foreground">{formatCurrency(row.total_amount)}</span>
      ),
    },
  ];

  return (
    <Card className="shadow-card ring-0">
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
        <CardAction>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as BookingStatus | "all");
              setPage(1);
            }}
          >
            <SelectTrigger size="sm" className="w-36">
              <LabeledSelectValue
                placeholder="Status"
                options={[
                  { value: "all", label: "All statuses" },
                  { value: "success", label: "Success" },
                  { value: "pending", label: "Pending" },
                  { value: "cancelled", label: "Cancelled" },
                ]}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          getRowId={(row) => row.id}
          isLoading={isLoading}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={data?.count ?? 0}
          onPageChange={setPage}
          emptyMessage="No transactions in this range."
          renderMobileCard={(row) => (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                  {row.vehicle?.image_url && (
                    <VehicleImage
                      src={row.vehicle.image_url}
                      alt={row.vehicle.name}
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-medium text-foreground">
                    {row.vehicle?.name ?? "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {row.created_at ? formatTimeAgo(row.created_at) : "—"}
                  </span>
                </div>
                <BookingStatusBadge status={row.status} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-accent">#{row.reference}</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(row.total_amount)}
                </span>
              </div>
            </div>
          )}
        />
      </CardContent>
    </Card>
  );
}
