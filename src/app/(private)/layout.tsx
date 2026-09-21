import type { Metadata } from "next";
import { RootShell } from "@/components/root-shell";
import { getMessages } from "@/lib/i18n/messages";
import { getPortalLocale } from "@/lib/i18n/portal";
import { createT } from "@/lib/i18n/t";

// The admin console is English-only and the host portal is being translated; neither is ever indexed.
export const metadata: Metadata = {
  title: { template: "%s | BestCar", default: "BestCar" },
  robots: { index: false, follow: false },
};

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  // The admin console has no language header, so it stays English; the host portal gets the visitor's language.
  const locale = await getPortalLocale();
  const skipLabel = createT(locale, await getMessages(locale))("common.skipToContent");
  return (
    <RootShell locale={locale} skipLabel={skipLabel}>
      {children}
    </RootShell>
  );
}
