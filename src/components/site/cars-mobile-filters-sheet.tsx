"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CarsFilterControls } from "@/components/site/cars-filter-controls";
import type { CarsFilters } from "@/components/site/cars-filter-sidebar";
import { useT } from "@/lib/i18n/provider";

export function CarsMobileFiltersSheet({ filters }: { filters: CarsFilters }) {
  const [open, setOpen] = useState(false);
  const t = useT();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="gap-2 lg:hidden"
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal className="size-4" /> {t("cars.filters")}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>{t("cars.filters")}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            <CarsFilterControls filters={filters} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
