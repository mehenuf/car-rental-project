"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV } from "@/lib/admin-nav";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNavList({
  collapsibleLabels = false,
  onNavigate,
}: {
  /** Hide labels/group headers below the `lg` breakpoint (icon-only tablet strip). */
  collapsibleLabels?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-(--space-md) overflow-y-auto px-(--space-2xs) py-(--space-sm)">
      {ADMIN_NAV.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <span
            className={cn(
              "px-(--space-xs) text-[11px] font-semibold tracking-wider text-sidebar-foreground/45 uppercase",
              collapsibleLabels && "hidden lg:block"
            )}
          >
            {group.label}
          </span>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={item.label}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-(--space-xs) py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-white/[0.06] hover:text-sidebar-foreground",
                      collapsibleLabels && "justify-center lg:justify-start",
                      active &&
                        "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <Icon className="size-[18px] shrink-0" />
                    <span className={cn("truncate", collapsibleLabels && "hidden lg:inline")}>
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
