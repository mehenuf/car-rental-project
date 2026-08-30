"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  className?: string;
  render: (row: T, index: number) => ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowId: (row: T) => string;
  isLoading?: boolean;
  skeletonRows?: number;
  emptyMessage?: ReactNode;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSortChange?: (key: string) => void;
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  /** Custom mobile-card renderer; falls back to a generic label/value stack built from `columns`. */
  renderMobileCard?: (row: T, index: number) => ReactNode;
}

const alignClass: Record<NonNullable<DataTableColumn<unknown>["align"]>, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export function DataTable<T>({
  columns,
  data,
  getRowId,
  isLoading = false,
  skeletonRows = 5,
  emptyMessage = "No results.",
  sortBy,
  sortOrder = "desc",
  onSortChange,
  page,
  pageSize,
  totalCount,
  onPageChange,
  renderMobileCard,
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(totalCount, page * pageSize);

  return (
    <div className="flex flex-col gap-(--space-sm)">
      {/* Desktop / tablet: real table */}
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((col) => (
                <TableHead key={col.key} className={cn(alignClass[col.align ?? "left"], col.className)}>
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => onSortChange?.(col.key)}
                      className="inline-flex items-center gap-1 font-medium text-foreground hover:text-accent"
                    >
                      {col.header}
                      <SortIcon active={sortBy === col.key} order={sortOrder} />
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: skeletonRows }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    {columns.map((col) => (
                      <TableCell key={col.key} className={alignClass[col.align ?? "left"]}>
                        <Skeleton className="h-5 w-full max-w-32" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : data.length === 0
                ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={columns.length} className="py-10">
                        <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
                          {emptyMessage}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                : data.map((row, index) => (
                    <TableRow key={getRowId(row)}>
                      {columns.map((col) => (
                        <TableCell key={col.key} className={cn(alignClass[col.align ?? "left"], col.className)}>
                          {col.render(row, index)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
          </TableBody>
        </Table>
      </div>

      {/* Phone: stacked cards */}
      <div className="flex flex-col gap-(--space-2xs) sm:hidden">
        {isLoading
          ? Array.from({ length: skeletonRows }).map((_, i) => (
              <Skeleton key={`skeleton-card-${i}`} className="h-24 w-full rounded-lg" />
            ))
          : data.length === 0
            ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </div>
              )
            : data.map((row, index) => (
                <div key={getRowId(row)} className="rounded-lg border border-border p-(--space-xs)">
                  {renderMobileCard
                    ? renderMobileCard(row, index)
                    : (
                        <dl className="flex flex-col gap-1.5">
                          {columns.map((col) => (
                            <div key={col.key} className="flex items-center justify-between gap-2 text-sm">
                              <dt className="text-muted-foreground">{col.header}</dt>
                              <dd className="text-right font-medium text-foreground">{col.render(row, index)}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                </div>
              ))}
      </div>

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between gap-(--space-xs) text-sm text-muted-foreground">
          <span>
            Showing {rangeStart}-{rangeEnd} of {totalCount}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft />
            </Button>
            <span className="px-1 tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              aria-label="Next page"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SortIcon({ active, order }: { active: boolean; order: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="size-3.5 text-muted-foreground/60" />;
  return order === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />;
}
