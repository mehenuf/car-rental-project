import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/dictionary";
import { alternatesFor } from "@/lib/seo/urls";

/** Title plus canonical and per-language alternates for a page path. */
export async function pageMetadata(path: string, meta: Pick<Metadata, "title" | "description">): Promise<Metadata> {
  const locale = await getLocale();
  return { ...meta, alternates: alternatesFor(locale, path), openGraph: { title: meta.title ?? undefined, description: meta.description ?? undefined, locale } };
}
