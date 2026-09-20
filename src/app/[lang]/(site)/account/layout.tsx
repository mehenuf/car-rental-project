import type { ReactNode } from "react";
import { Link } from "@/lib/i18n/link";
import { getT } from "@/lib/i18n/dictionary";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const t = await getT();
  const tabs = [
    { href: "/account", label: t("account.navTrips") },
    { href: "/account/driver", label: t("account.navDriver") },
    { href: "/account/notifications", label: t("notify.navLabel") },
    { href: "/account/security", label: t("account.navSecurity") },
  ];
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-(--space-md) px-(--space-sm) py-(--space-xl)">
      <nav aria-label={t("account.title")} className="flex flex-wrap gap-2 border-b border-border pb-(--space-xs)">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
