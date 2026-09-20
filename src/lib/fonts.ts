import {
  Geist_Mono,
  Inter,
  Noto_Sans_Arabic,
  Noto_Sans_Bengali,
  Noto_Sans_JP,
  Noto_Sans_SC,
  Sora,
} from "next/font/google";
import type { Locale } from "@/lib/i18n/locales";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
// One variable file covers every heading weight, instead of a file per weight.
const sora = Sora({ variable: "--font-sora", subsets: ["latin"] });
// Only used in the host portal, so it is fetched when needed rather than preloaded on every page.
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], preload: false });

// Script fonts carry their own Latin glyphs, so one variable covers a whole page.
// Only the active language's class is applied, so the others are never downloaded.
const notoArabic = Noto_Sans_Arabic({ variable: "--font-script", subsets: ["arabic"], display: "swap" });
const notoBengali = Noto_Sans_Bengali({ variable: "--font-script", subsets: ["bengali"], display: "swap" });
const notoSC = Noto_Sans_SC({ variable: "--font-script", subsets: ["latin"], preload: false, display: "swap" });
const notoJP = Noto_Sans_JP({ variable: "--font-script", subsets: ["latin"], preload: false, display: "swap" });

const SCRIPT_FONT: Partial<Record<Locale, string>> = {
  ar: notoArabic.variable,
  bn: notoBengali.variable,
  zh: notoSC.variable,
  ja: notoJP.variable,
};

/** Class names for `<html>`: the Latin fonts always, plus the script font for the language. */
export function fontClassesFor(locale: Locale): string {
  return [inter.variable, sora.variable, geistMono.variable, SCRIPT_FONT[locale]].filter(Boolean).join(" ");
}
