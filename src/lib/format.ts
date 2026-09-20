import { numberingLocale, type Locale } from "@/lib/i18n/locales";

/** Dollar amounts (the admin dashboards). Pass a locale to format for a language. */
export function formatCurrency(value: number, locale: Locale = "en"): string {
  return new Intl.NumberFormat(numberingLocale(locale), { style: "currency", currency: "USD" }).format(value);
}

/** "Jane Doe" -> "JD"; falls back gracefully for a single word or an email. */
export function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function formatNumber(value: number, locale: Locale = "en"): string {
  return new Intl.NumberFormat(numberingLocale(locale)).format(value);
}

export function formatDate(dateInput: string | Date, locale: Locale = "en"): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return date.toLocaleDateString(locale === "en" ? "en-US" : numberingLocale(locale), {
    day: "2-digit",
    month: locale === "en" ? "short" : "2-digit",
    year: "numeric",
  });
}

export function formatTimeAgo(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;

  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;

  const years = Math.round(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
