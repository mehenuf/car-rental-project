"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages = visiblePages(page, totalPages);

  return (
    <nav className="flex items-center justify-center gap-1.5" aria-label="Pagination">
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" />
      </Button>

      {pages.map((p, i) =>
        p === "ellipsis" ? (
          <span key={`ellipsis-${i}`} className="px-1 text-sm text-muted-foreground">
            &hellip;
          </span>
        ) : (
          <Button
            key={p}
            type="button"
            variant={p === page ? "default" : "outline"}
            size="icon"
            onClick={() => onPageChange(p)}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </Button>
        )
      )}

      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight className="size-4" />
      </Button>
    </nav>
  );
}

function visiblePages(page: number, totalPages: number): (number | "ellipsis")[] {
  const delta = 1;
  const range: (number | "ellipsis")[] = [];
  const start = Math.max(2, page - delta);
  const end = Math.min(totalPages - 1, page + delta);

  range.push(1);
  if (start > 2) range.push("ellipsis");
  for (let i = start; i <= end; i++) range.push(i);
  if (end < totalPages - 1) range.push("ellipsis");
  if (totalPages > 1) range.push(totalPages);

  return range;
}
