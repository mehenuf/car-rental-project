import "server-only";
import { headers } from "next/headers";
import { DEFAULT_LOCALE, hasLocale, type Locale } from "./locales";
import { getMessages } from "./messages";
import { createT } from "./t";
import { PORTAL_LANG_HEADER } from "./portal-header";

/** The language of a host-portal request, from the header the proxy sets. Falls back to English (admin and direct calls). */
export async function getPortalLocale(): Promise<Locale> {
  const value = (await headers()).get(PORTAL_LANG_HEADER);
  return value && hasLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getPortalT() {
  const locale = await getPortalLocale();
  return createT(locale, await getMessages(locale));
}
