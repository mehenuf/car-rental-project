"use client";

import { useState, type ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminMobileSidebar } from "@/components/admin/admin-mobile-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { AdminFooter } from "@/components/admin/admin-footer";

export function AdminShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AdminSidebar />
      <AdminMobileSidebar open={mobileNavOpen} onOpenChange={setMobileNavOpen} />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <AdminTopbar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="min-w-0 flex-1 p-(--space-sm) lg:p-(--space-md)">{children}</main>
        <AdminFooter />
      </div>
    </div>
  );
}
