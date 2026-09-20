import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RootShell } from "@/components/root-shell";
import { ConsentManager } from "@/components/site/consent";
import { I18nProvider } from "@/lib/i18n/provider";
import { getMessages } from "@/lib/i18n/dictionary";
import { LOCALES, hasLocale } from "@/lib/i18n/locales";
import { createT } from "@/lib/i18n/t";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = createT(lang, await getMessages(lang));
  return {
    title: { template: "%s | BestCar", default: t("meta.siteTitle") },
    description: t("meta.siteDescription"),
  };
}

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export default async function LangLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const messages = await getMessages(lang);

  return (
    <RootShell locale={lang} skipLabel={createT(lang, messages)("common.skipToContent")}>
      <I18nProvider locale={lang} messages={messages}>
        {children}
        <ConsentManager />
      </I18nProvider>
    </RootShell>
  );
}
