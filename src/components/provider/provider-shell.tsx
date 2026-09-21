"use client";

import { useState, type ReactNode } from "react";
import { Link } from "@/lib/i18n/link";
import { useT } from "@/lib/i18n/provider";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { providerNav } from "@/lib/provider-nav";
import type { ProviderRole } from "@/lib/provider/permissions";
import type { ProviderType } from "@/types/database";

/** The provider portal frame: the admin shell with the provider menu and a switcher for people in several providers. */
export function ProviderShell({
  type,
  role,
  providers,
  activeId,
  children,
}: {
  type: ProviderType;
  role: ProviderRole;
  providers: { id: string; name: string }[];
  activeId: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const t = useT();
  const [switching, setSwitching] = useState(false);

  async function switchTo(providerId: string) {
    setSwitching(true);
    await fetch("/api/provider/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider_id: providerId }),
    });
    setSwitching(false);
    router.refresh();
  }

  const extra = (
    <div className="me-2 flex items-center gap-2 text-sm">
      {providers.length > 1 ? (
        <select
          aria-label={t("portal.shell.switchProvider")}
          value={activeId}
          disabled={switching}
          onChange={(e) => switchTo(e.target.value)}
          className="h-8 max-w-44 rounded-lg border border-input bg-transparent px-2 text-sm"
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      ) : (
        <span className="hidden max-w-44 truncate text-muted-foreground sm:inline">{providers[0]?.name}</span>
      )}
      <Link href="/dashboard" className="hidden text-muted-foreground underline-offset-2 hover:underline sm:inline">
        {t("portal.shell.personalAccount")}
      </Link>
    </div>
  );

  return (
    <AdminShell nav={providerNav(type, role, t)} rootHref="/provider" loginPath="/login" topbarExtra={extra}>
      {children}
    </AdminShell>
  );
}
