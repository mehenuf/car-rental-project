import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RootShell } from "@/components/root-shell";
import { I18nProvider } from "@/lib/i18n/provider";
import { getMessages } from "@/lib/i18n/dictionary";
import { LOCALES, hasLocale } from "@/lib/i18n/locales";
import { createT } from "@/lib/i18n/t";

export const metadata: Metadata = {
  title: {
    template: "%s | BestCar",
    default: "BestCar — Rent a Car in Minutes",
  },
  description:
    "Book a rental car in minutes. No account required, transparent pricing, pick-up points across the country.",
};

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
      </I18nProvider>
    </RootShell>
  );
}
