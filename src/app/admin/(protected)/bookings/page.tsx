"use client";

import { useEffect, useState } from "react";
import { VehicleImage } from "@/components/site/vehicle-image";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { DateRangePicker } from "@/components/admin/date-range-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { LabeledSelectValue } from "@/components/labeled-select-value";
import { useApiData } from "@/hooks/use-api-data";
import { defaultDateRange, toApiDate, type DateRange } from "@/lib/date-range";
import { formatCurrency, formatDate } from "@/lib/format";
import type { BookingStatus } from "@/types/database";

interface BookingRow {
  id: string;
  reference: string;
  customer_name: string;
  email: string;
  payment_method: string | null;
  status: BookingStatus;
  total_amount: number;
  pickup_at: string;
  dropoff_at: string;
  created_at: string | null;
  vehicle: { name: string; image_url: string } | null;
}

interface BookingsResponse {
  data: BookingRow[];
  count: number;
}

const PAGE_SIZE = 10;
type SortBy = "created_at" | "total_amount" | "pickup_at";

const STATUS_TRIGGER_STYLES: Record<BookingStatus, string> = {
  success: "border-success/30 bg-success/10 text-success",
  pending: "border-info/30 bg-info/10 text-info",
  cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
};

export default function AdminBookingsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<BookingStatus | "all">("all");
  const [range, setRange] = useState<DateRange>(() => defaultDateRange());
  const [sortBy, setSortBy] = useState<SortBy>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timeout);
  }, [search]);

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
  if (debouncedSearch) params.set("search", debouncedSearch);

  const { data, isLoading, error } = useApiData<BookingsResponse>(
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

  async function handleStatusChange(id: string, nextStatus: BookingStatus) {
    setUpdatingId(id);
    setStatusError(null);
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Failed to update status");
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  }

  const columns: DataTableColumn<BookingRow>[] = [
    {
      key: "created_at",
      header: "Order Details",
      sortable: true,
      render: (row) => (
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
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">
              {row.vehicle?.name ?? "—"}
            </span>
            <span className="text-xs text-accent">#{row.reference}</span>
          </div>
        </div>
      ),
    },
    {
      key: "customer_name",
      header: "Customer",
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-sm text-foreground">{row.customer_name}</span>
          <span className="text-xs text-muted-foreground">{row.email}</span>
        </div>
      ),
    },
    {
      key: "pickup_at",
      header: "Rental Period",
      sortable: true,
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.pickup_at)} &ndash; {formatDate(row.dropoff_at)}
        </span>
      ),
    },
    {
      key: "payment_method",
      header: "Payment",
      render: (row) => (
        <span className="text-sm text-foreground capitalize">
          {row.payment_method?.replace("_", " ") ?? "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Select
          value={row.status}
          onValueChange={(value) => handleStatusChange(row.id, value as BookingStatus)}
          disabled={updatingId === row.id}
        >
          <SelectTrigger size="sm" className={`w-32 ${STATUS_TRIGGER_STYLES[row.status]}`}>
            <LabeledSelectValue
              options={[
                { value: "success", label: "Success" },
                { value: "pending", label: "Pending" },
                { value: "cancelled", label: "Cancelled" },
              ]}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      ),
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
    <div className="flex flex-col gap-(--space-md)">
      <h1 className="font-heading text-xl font-bold text-foreground">Sales</h1>

      <Card className="shadow-card ring-0">
        <CardHeader className="flex flex-col items-stretch gap-(--space-xs) xl:flex-row xl:items-center xl:justify-between">
          <CardTitle>All Bookings</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Input
              placeholder="Search by customer or reference"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="sm:w-56"
            />
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value as BookingStatus | "all");
                setPage(1);
              }}
            >
              <SelectTrigger className="sm:w-36">
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
            <DateRangePicker
              value={range}
              onChange={(next) => {
                setRange(next);
                setPage(1);
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          {(error || statusError) && (
            <p className="mb-2 text-sm text-destructive">{error ?? statusError}</p>
          )}
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
            emptyMessage="No bookings match your filters."
          />
        </CardContent>
      </Card>
    </div>
  );
}
