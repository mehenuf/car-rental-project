"use client";

import { usePathname } from "next/navigation";
import { Link } from "@/lib/i18n/link";

/** The account section's tabs. The one for the page you are on says so (aria-current) and looks selected. */
export function AccountTabs({ tabs, label }: { tabs: { href: string; label: string }[]; label: string }) {
  // "/en/account/driver" -> "/account/driver"
  const bare = "/" + usePathname().split("/").slice(2).join("/");
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2 border-b border-border pb-(--space-xs)">
      {tabs.map((tab) => {
        // "/account" is the trips tab, so it is only current on its own path and on a single trip below it.
        const current = tab.href === "/account" ? bare === "/account" || bare.startsWith("/account/trips/") : bare === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current ? "page" : undefined}
            className="min-h-8 rounded-full border border-border px-3 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:border-accent aria-[current=page]:bg-accent/10 aria-[current=page]:font-medium aria-[current=page]:text-foreground pointer-coarse:min-h-11 pointer-coarse:py-2"
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
