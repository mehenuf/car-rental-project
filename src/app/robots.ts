import type { MetadataRoute } from "next";
import { LOCALES } from "@/lib/i18n/locales";
import { siteUrl } from "@/lib/seo/urls";

// The private areas live under a language prefix (/en/account), so each prefix needs its own rule.
const PRIVATE_PAGES = ["account", "dashboard", "checkout", "booking-confirmation", "provider"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/provider", ...LOCALES.flatMap((locale) => PRIVATE_PAGES.map((page) => `/${locale}/${page}`))] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
