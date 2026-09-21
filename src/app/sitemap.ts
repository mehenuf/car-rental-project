import type { MetadataRoute } from "next";
import { supabaseAdmin } from "@/lib/supabase-server";
import { LOCALES } from "@/lib/i18n/locales";
import { citySlug } from "@/lib/seo/city";
import { alternatesFor, localizedUrl } from "@/lib/seo/urls";

// Vehicles and cities are added by hosts after a deploy, so regenerate hourly instead of once per build.
export const revalidate = 3600;

const STATIC_PATHS = ["/", "/cars", "/about", "/contact", "/privacy", "/terms"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data } = await supabaseAdmin.from("vehicles").select("slug").order("id").limit(5000);
  const { data: branches } = await supabaseAdmin.from("branches").select("city").eq("is_active", true);
  const cities = [...new Set((branches ?? []).map((b) => citySlug(b.city)).filter(Boolean))];
  const paths = [...STATIC_PATHS, ...cities.map((c) => `/cars/in/${c}`), ...(data ?? []).map((v) => `/cars/${v.slug}`)];
  return paths.flatMap((path) =>
    LOCALES.map((locale) => ({
      url: localizedUrl(locale, path),
      alternates: { languages: alternatesFor(locale, path).languages },
    })),
  );
}
