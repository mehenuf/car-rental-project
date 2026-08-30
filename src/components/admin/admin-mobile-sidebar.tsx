"use client";

import Link from "next/link";
import { Car } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AdminNavList } from "@/components/admin/admin-nav-list";

export function AdminMobileSidebar({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="w-72 gap-0 bg-sidebar p-0 text-sidebar-foreground"
      >
        <SheetHeader className="h-16 shrink-0 justify-center border-b border-sidebar-border">
          <SheetTitle
            render={
              <Link
                href="/"
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-2 text-sidebar-foreground"
              />
            }
          >
            <Car className="size-6 text-sidebar-accent" />
            BestCar
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          <AdminNavList onNavigate={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
