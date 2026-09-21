import type { Locale as DayPickerLocale } from "react-day-picker";
import type { Locale } from "./locales";

/**
 * The date-picker's month and weekday names for a site language, loaded on demand: each language's data is its own
 * small file, so opening the calendar downloads one language instead of all eleven (about 74 KB together).
 */
const LOADERS: Record<Locale, () => Promise<DayPickerLocale>> = {
  en: () => import("react-day-picker/locale/en-US").then((m) => m.enUS),
  ar: () => import("react-day-picker/locale/ar").then((m) => m.ar),
  bn: () => import("react-day-picker/locale/bn").then((m) => m.bn),
  de: () => import("react-day-picker/locale/de").then((m) => m.de),
  es: () => import("react-day-picker/locale/es").then((m) => m.es),
  fr: () => import("react-day-picker/locale/fr").then((m) => m.fr),
  ja: () => import("react-day-picker/locale/ja").then((m) => m.ja),
  nl: () => import("react-day-picker/locale/nl").then((m) => m.nl),
  pt: () => import("react-day-picker/locale/pt").then((m) => m.pt),
  zh: () => import("react-day-picker/locale/zh-CN").then((m) => m.zhCN),
  id: () => import("react-day-picker/locale/id").then((m) => m.id),
};

export function loadCalendarLocale(locale: Locale): Promise<DayPickerLocale> {
  return LOADERS[locale]();
}
