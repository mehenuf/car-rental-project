import type { Locale as DayPickerLocale } from "react-day-picker";
import { ar, bn, de, es, fr, ja, nl, pt, zhCN, id, enUS } from "react-day-picker/locale";
import type { Locale } from "./locales";

const CALENDAR_LOCALES: Record<Locale, DayPickerLocale> = {
  en: enUS,
  ar,
  bn,
  de,
  es,
  fr,
  ja,
  nl,
  pt,
  zh: zhCN,
  id,
};

/** The date-picker's month and weekday names for a site language. */
export function calendarLocale(locale: Locale): DayPickerLocale {
  return CALENDAR_LOCALES[locale];
}
