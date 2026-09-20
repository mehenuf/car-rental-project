import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo/urls";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/provider", "/account", "/dashboard", "/checkout"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
