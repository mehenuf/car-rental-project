import type { MetadataRoute } from "next";
import { supabaseAdmin } from "@/lib/supabase-server";
import { LOCALES } from "@/lib/i18n/locales";
import { alternatesFor, localizedUrl } from "@/lib/seo/urls";

const STATIC_PATHS = ["/", "/cars", "/about", "/contact", "/privacy", "/terms"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data } = await supabaseAdmin.from("vehicles").select("slug").order("id").limit(5000);
  const paths = [...STATIC_PATHS, ...(data ?? []).map((v) => `/cars/${v.slug}`)];
  return paths.flatMap((path) =>
    LOCALES.map((locale) => ({
      url: localizedUrl(locale, path),
      alternates: { languages: alternatesFor(locale, path).languages },
    })),
  );
}
