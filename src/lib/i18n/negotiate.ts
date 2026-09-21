import { COUNTRY_DEFAULT_LANGUAGE, DEFAULT_LOCALE, LOCALES, hasLocale, type Locale } from "./locales";

/** Language tags from an Accept-Language header, best first, regions dropped. */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const quality = q ? Number.parseFloat(q.slice(2)) : 1;
      return { tag: (tag ?? "").trim().toLowerCase(), quality, index };
    })
    .filter((e) => /^([a-z]{2,3}|\*)(-[a-z0-9]+)*$/.test(e.tag) && e.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index)
    .map((e) => e.tag.split("-")[0]!);
}

export interface NegotiationInput {
  cookie?: string | null;
  acceptLanguage?: string | null;
  country?: string | null;
}

/** Saved preference, then Accept-Language, then the visitor country, then English. */
export function negotiateLocale(input: NegotiationInput): Locale {
  if (input.cookie && hasLocale(input.cookie)) return input.cookie;
  for (const tag of parseAcceptLanguage(input.acceptLanguage)) {
    if (hasLocale(tag)) return tag;
  }
  const byCountry = input.country ? COUNTRY_DEFAULT_LANGUAGE[input.country.toUpperCase()] : undefined;
  return byCountry ?? DEFAULT_LOCALE;
}

export function stripLocale(pathname: string): { locale: Locale | null; path: string } {
  for (const locale of LOCALES) {
    if (pathname === `/${locale}`) return { locale, path: "/" };
    if (pathname.startsWith(`/${locale}/`)) return { locale, path: pathname.slice(locale.length + 1) };
  }
  return { locale: null, path: pathname };
}

/** Areas that are not locale-prefixed: private portals, APIs and Next internals. */
const UNPREFIXED = ["/admin", "/provider", "/api", "/_next"];

/** The public provider application page lives under /provider but is a site page. */
const PUBLIC_EXCEPTIONS = ["/provider/apply"];

export function isUnprefixedPath(pathname: string): boolean {
  if (PUBLIC_EXCEPTIONS.includes(pathname)) return false;
  return UNPREFIXED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** The host portal: unprefixed like the admin console, but shown in the visitor's language (the sign-in prompt at /provider/apply is a site page). */
export function isPortalPath(pathname: string): boolean {
  return (pathname === "/provider" || pathname.startsWith("/provider/")) && !PUBLIC_EXCEPTIONS.includes(pathname);
}

/** Prefix an internal href with a locale; private, API and external targets are left alone. */
export function withLocale(locale: Locale, href: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const { path } = stripLocale(href);
  const pathOnly = path.split(/[?#]/)[0]!;
  if (isUnprefixedPath(pathOnly)) return href;
  if (path === "/") return `/${locale}`;
  if (path.startsWith("/?") || path.startsWith("/#")) return `/${locale}${path.slice(1)}`;
  return `/${locale}${path}`;
}
