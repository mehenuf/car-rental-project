import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { hasLocale, type Locale } from "./locales";
import { getMessages } from "./messages";
import { createT } from "./t";

export { getMessages };

/** The current request's language, from the `[lang]` root parameter. */
export async function getLocale(): Promise<Locale> {
  const value = await lang();
  if (!hasLocale(value)) notFound();
  return value;
}

export async function getT() {
  const locale = await getLocale();
  return createT(locale, await getMessages(locale));
}
