"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CarsFilterControls } from "@/components/site/cars-filter-controls";
import type { CarsFilters } from "@/components/site/cars-filter-sidebar";

export function CarsMobileFiltersSheet({ filters }: { filters: CarsFilters }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="gap-2 lg:hidden"
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal className="size-4" /> Filters
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            <CarsFilterControls filters={filters} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
