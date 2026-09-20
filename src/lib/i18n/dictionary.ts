import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { DEFAULT_LOCALE, hasLocale, type Locale } from "./locales";
import { deepMerge } from "./merge";
import { pseudoLocalize } from "./pseudo";
import { createT, type Messages } from "./t";

const loaders: Record<Locale, () => Promise<Messages>> = {
  en: () => import("@/messages/en.json").then((m) => m.default as Messages),
  bn: () => import("@/messages/bn.json").then((m) => m.default as Messages),
  es: () => import("@/messages/es.json").then((m) => m.default as Messages),
  fr: () => import("@/messages/fr.json").then((m) => m.default as Messages),
  ar: () => import("@/messages/ar.json").then((m) => m.default as Messages),
  pt: () => import("@/messages/pt.json").then((m) => m.default as Messages),
  zh: () => import("@/messages/zh.json").then((m) => m.default as Messages),
  ja: () => import("@/messages/ja.json").then((m) => m.default as Messages),
  nl: () => import("@/messages/nl.json").then((m) => m.default as Messages),
  de: () => import("@/messages/de.json").then((m) => m.default as Messages),
  id: () => import("@/messages/id.json").then((m) => m.default as Messages),
};

/** The current request's language, from the `[lang]` root parameter. */
export async function getLocale(): Promise<Locale> {
  const value = await lang();
  if (!hasLocale(value)) notFound();
  return value;
}

/** The locale's messages with English filling any gap, so the client never sees a missing key. */
export async function getMessages(locale: Locale): Promise<Messages> {
  const english = await loaders[DEFAULT_LOCALE]();
  // `PSEUDO_LOCALE=1 npm run dev` shows accented, lengthened English to expose layout problems.
  if (process.env.NODE_ENV !== "production" && process.env.PSEUDO_LOCALE === "1") return pseudoLocalize(english);
  if (locale === DEFAULT_LOCALE) return english;
  return deepMerge(english, await loaders[locale]());
}

export async function getT() {
  const locale = await getLocale();
  return createT(locale, await getMessages(locale));
}
