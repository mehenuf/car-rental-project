import Link from "next/link";
import { Car } from "lucide-react";
import { AdminNavList } from "@/components/admin/admin-nav-list";
import type { AdminNavGroup } from "@/lib/admin-nav";

/**
 * Static sidebar: full width with labels at `lg`+, an icon-only strip
 * between `md` and `lg`, and not rendered at all below `md` — the phone
 * drawer (AdminMobileSidebar) takes over there.
 */
export function AdminSidebar({ nav, rootHref }: { nav?: AdminNavGroup[]; rootHref?: string } = {}) {
  return (
    <aside className="sticky top-0 hidden h-[100dvh] w-16 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex lg:w-64">
      <Link
        href="/"
        className="flex h-16 shrink-0 items-center justify-center gap-2 border-b border-sidebar-border px-(--space-sm) lg:justify-start"
      >
        <Car className="size-6 shrink-0 text-sidebar-accent" />
        <span className="hidden font-heading text-lg font-bold lg:inline">BestCar</span>
      </Link>
      <AdminNavList collapsibleLabels nav={nav} rootHref={rootHref} />
    </aside>
  );
}
