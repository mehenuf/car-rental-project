import { Geist_Mono, Inter, Sora } from "next/font/google";
import type { Locale } from "@/lib/i18n/locales";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
// One variable file covers every heading weight, instead of a file per weight.
const sora = Sora({ variable: "--font-sora", subsets: ["latin"] });
// Only used in the host portal, so it is fetched when needed rather than preloaded on every page.
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], preload: false });

// Arabic and Bengali get a web font, each in its own module and loaded only for that language. Chinese and Japanese use
// the fonts already on the visitor's device (see globals.css): Noto Sans SC and JP came with about 185 KB of @font-face
// rules (roughly 65 KB gzipped) in render-blocking CSS on every page, in every language, so they were removed.
const SCRIPT_FONT: Partial<Record<Locale, () => Promise<{ scriptFont: { variable: string } }>>> = {
  ar: () => import("./fonts/arabic"),
  bn: () => import("./fonts/bengali"),
};

/** Class names for `<html>`: the Latin fonts always, plus the script font for the language. */
export async function fontClassesFor(locale: Locale): Promise<string> {
  const script = await SCRIPT_FONT[locale]?.();
  return [inter.variable, sora.variable, geistMono.variable, script?.scriptFont.variable].filter(Boolean).join(" ");
}
