import { numberingLocale, type Locale } from "./locales";

export function formatMoney(amount: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(numberingLocale(locale), { style: "currency", currency }).format(amount);
}

export function formatNumberLocale(value: number, locale: Locale): string {
  return new Intl.NumberFormat(numberingLocale(locale)).format(value);
}

export function formatDateLocale(date: Date | string, locale: Locale, timeZone?: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(numberingLocale(locale), {
    day: locale === "en" ? "numeric" : "2-digit",
    month: locale === "en" ? "short" : "2-digit",
    year: "numeric",
    timeZone,
  }).format(d);
}

export function formatList(items: string[], locale: Locale): string {
  return new Intl.ListFormat(numberingLocale(locale), { style: "long", type: "conjunction" }).format(items);
}

export function formatRelative(date: Date, locale: Locale, now: Date = new Date()): string {
  const rtf = new Intl.RelativeTimeFormat(numberingLocale(locale), { numeric: "auto" });
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(seconds, "second");
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(seconds / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(seconds / (86400 * 30)), "month");
  return rtf.format(Math.round(seconds / (86400 * 365)), "year");
}
