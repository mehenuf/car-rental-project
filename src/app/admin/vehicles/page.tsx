"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { VehicleFormDialog, type VehicleFormValues } from "@/components/admin/vehicle-form-dialog";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useApiData } from "@/hooks/use-api-data";
import { formatCurrency } from "@/lib/format";
import type { Tables, VehicleCategory } from "@/types/database";

interface VehiclesResponse {
  data: Tables<"vehicles">[];
  count: number;
}

const PAGE_SIZE = 10;
type SortBy = "price_per_day" | "rating" | "created_at" | "name";

export default function AdminVehiclesPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState<VehicleCategory | "all">("all");
  const [sortBy, setSortBy] = useState<SortBy>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Tables<"vehicles"> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Tables<"vehicles"> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timeout);
  }, [search]);

  const params = new URLSearchParams({
    sortBy,
    sortOrder,
    page: String(page),
    pageSize: String(PAGE_SIZE),
    _r: String(refreshKey),
  });
  if (category !== "all") params.set("category", category);
  if (debouncedSearch) params.set("search", debouncedSearch);

  const { data, isLoading, error } = useApiData<VehiclesResponse>(
    `/api/vehicles?${params.toString()}`
  );

  function handleSortChange(key: string) {
    if (key === sortBy) {
      setSortOrder((order) => (order === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key as SortBy);
      setSortOrder("asc");
    }
    setPage(1);
  }

  function openCreate() {
    setEditingVehicle(null);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(vehicle: Tables<"vehicles">) {
    setEditingVehicle(vehicle);
    setFormError(null);
    setFormOpen(true);
  }

  async function handleSubmit(values: VehicleFormValues) {
    setIsSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/vehicles", {
        method: editingVehicle ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingVehicle ? { id: editingVehicle.id, ...values } : values),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Failed to save vehicle");
      setFormOpen(false);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save vehicle");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/vehicles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Failed to delete vehicle");
      setDeleteTarget(null);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete vehicle");
    } finally {
      setIsDeleting(false);
    }
  }

  const columns: DataTableColumn<Tables<"vehicles">>[] = [
    {
      key: "name",
      header: "Vehicle",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
            <Image src={row.image_url} alt={row.name} fill sizes="40px" className="object-cover" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{row.name}</span>
            <span className="text-xs text-muted-foreground">{row.brand}</span>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (row) => (
        <Badge variant="outline" className="capitalize">
          {row.category}
        </Badge>
      ),
    },
    {
      key: "price_per_day",
      header: "Price / day",
      sortable: true,
      align: "right",
      render: (row) => formatCurrency(row.price_per_day),
    },
    {
      key: "specs",
      header: "Specs",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.seats} seats &middot; {row.transmission} &middot; {row.fuel}
        </span>
      ),
    },
    {
      key: "stock",
      header: "Stock",
      align: "right",
      render: (row) => row.stock,
    },
    {
      key: "available",
      header: "Status",
      render: (row) => (
        <Badge
          className={
            row.available
              ? "border-0 bg-success/15 text-success"
              : "border-0 bg-muted text-muted-foreground"
          }
        >
          {row.available ? "Available" : "Unavailable"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => openEdit(row)}
            aria-label={`Edit ${row.name}`}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              setDeleteError(null);
              setDeleteTarget(row);
            }}
            aria-label={`Delete ${row.name}`}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="flex flex-col gap-(--space-sm) sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-heading text-xl font-bold text-foreground">Products</h1>
        <Button type="button" onClick={openCreate} className="gap-1.5 self-start sm:self-auto">
          <Plus className="size-4" /> Add Vehicle
        </Button>
      </div>

      <Card className="shadow-card ring-0">
        <CardHeader className="flex flex-col items-stretch gap-(--space-xs) sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>All Vehicles</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Search by name, brand, or slug"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="sm:w-64"
            />
            <Select
              value={category}
              onValueChange={(value) => {
                setCategory(value as VehicleCategory | "all");
                setPage(1);
              }}
            >
              <SelectTrigger className="sm:w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="popular">Popular</SelectItem>
                <SelectItem value="large">Large</SelectItem>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="exclusive">Exclusive</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
            emptyMessage="No vehicles match your filters."
          />
        </CardContent>
      </Card>

      <VehicleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        vehicle={editingVehicle}
        onSubmit={handleSubmit}
        isSaving={isSaving}
        error={formError}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete vehicle?"
        description={
          deleteTarget
            ? `This will permanently remove "${deleteTarget.name}" from the fleet.`
            : ""
        }
        isConfirming={isDeleting}
        error={deleteError}
        onConfirm={handleDelete}
      />
    </div>
  );
}
