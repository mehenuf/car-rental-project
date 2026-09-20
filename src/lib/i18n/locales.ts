export const LOCALES = ["en", "bn", "es", "fr", "ar", "pt", "zh", "ja", "nl", "de", "id"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "bc_lang";

export function hasLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function directionOf(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Names shown in the language switcher, each in its own language. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  bn: "বাংলা",
  es: "Español",
  fr: "Français",
  ar: "العربية",
  pt: "Português",
  zh: "简体中文",
  ja: "日本語",
  nl: "Nederlands",
  de: "Deutsch",
  id: "Bahasa Indonesia",
};

/** Intl locale tag to format with. Arabic uses Western digits by default. */
export function numberingLocale(locale: Locale): string {
  return locale === "ar" ? "ar-u-nu-latn" : locale;
}

/** Default language per served country (India and Kenya fall back to English). */
export const COUNTRY_DEFAULT_LANGUAGE: Record<string, Locale> = {
  US: "en",
  GB: "en",
  AE: "ar",
  CA: "en",
  AU: "en",
  NL: "nl",
  DE: "de",
  FR: "fr",
  NG: "en",
  KE: "en",
  ID: "id",
  BR: "pt",
  IN: "en",
  BD: "bn",
  JP: "ja",
};
