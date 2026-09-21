import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ProviderShell } from "@/components/provider/provider-shell";
import { getProviderContext } from "@/lib/provider/context";
import { I18nProvider } from "@/lib/i18n/provider";
import { getMessages } from "@/lib/i18n/messages";
import { getPortalLocale } from "@/lib/i18n/portal";

export const metadata: Metadata = {
  title: { template: "%s | BestCar Partner", default: "Partner portal | BestCar" },
};

export default async function ProviderPortalLayout({ children }: { children: ReactNode }) {
  const context = await getProviderContext();
  if (!context) redirect("/login?next=%2Fprovider");

  // Not a provider yet, or not approved yet: the application page shows where things stand.
  const active = context.active;
  if (!active || active.provider.status !== "approved") redirect("/provider/apply");

  const locale = await getPortalLocale();
  const messages = await getMessages(locale);

  return (
    <I18nProvider locale={locale} messages={messages}>
      <ProviderShell
        type={active.provider.type}
        role={active.role}
        providers={context.memberships.map((m) => ({ id: m.providerId, name: m.provider.displayName }))}
        activeId={active.providerId}
      >
        {children}
      </ProviderShell>
    </I18nProvider>
  );
}
