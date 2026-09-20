import type { ReactNode } from "react";
import { Link } from "@/lib/i18n/link";
import { PolicyNotice } from "@/components/site/policy-notice";
import { readRequestIdentity } from "@/lib/guest";
import { getT } from "@/lib/i18n/dictionary";
import { supabaseAdmin } from "@/lib/supabase-server";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const t = await getT();
  const identity = await readRequestIdentity();
  const { data: pending } = identity.userId ? await supabaseAdmin.rpc("policies_to_accept", { p_user: identity.userId }) : { data: [] };
  const tabs = [
    { href: "/account", label: t("account.navTrips") },
    { href: "/account/driver", label: t("account.navDriver") },
    { href: "/account/notifications", label: t("notify.navLabel") },
    { href: "/account/security", label: t("account.navSecurity") },
    { href: "/account/privacy", label: t("privacy.navLabel") },
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
      {(pending ?? []).length > 0 && <PolicyNotice />}
      {children}
    </div>
  );
}
