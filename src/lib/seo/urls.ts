import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n/locales";

export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
  return raw.replace(/\/+$/, "");
}

/** `/` for the home page, otherwise the path without trailing slash. */
function clean(path: string): string {
  if (path === "" || path === "/") return "";
  return path.startsWith("/") ? path.replace(/\/+$/, "") : `/${path.replace(/\/+$/, "")}`;
}

export function localizedUrl(locale: Locale, path: string, base = siteUrl()): string {
  return `${base}/${locale}${clean(path)}`;
}

/** Canonical + hreflang alternates for one page; `x-default` is the English page. */
export function alternatesFor(locale: Locale, path: string, base = siteUrl()) {
  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = localizedUrl(l, path, base);
  languages["x-default"] = localizedUrl(DEFAULT_LOCALE, path, base);
  return { canonical: localizedUrl(locale, path, base), languages };
}
