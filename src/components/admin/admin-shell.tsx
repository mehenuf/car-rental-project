"use client";

import { useState, type ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminMobileSidebar } from "@/components/admin/admin-mobile-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { AdminFooter } from "@/components/admin/admin-footer";
import type { AdminNavGroup } from "@/lib/admin-nav";

export function AdminShell({
  children,
  nav,
  rootHref,
  loginPath,
  topbarExtra,
}: {
  children: ReactNode;
  nav?: AdminNavGroup[];
  rootHref?: string;
  loginPath?: string;
  topbarExtra?: ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-[100dvh] w-full bg-background">
      <AdminSidebar nav={nav} rootHref={rootHref} />
      <AdminMobileSidebar open={mobileNavOpen} onOpenChange={setMobileNavOpen} nav={nav} rootHref={rootHref} />

      <div className="flex min-h-[100dvh] min-w-0 flex-1 flex-col">
        <AdminTopbar onMenuClick={() => setMobileNavOpen(true)} loginPath={loginPath} extra={topbarExtra} />
        <main id="main-content" className="min-w-0 flex-1 p-(--space-sm) lg:p-(--space-md)">
          {children}
        </main>
        <AdminFooter />
      </div>
    </div>
  );
}
