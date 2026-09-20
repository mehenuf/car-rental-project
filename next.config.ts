import type { NextConfig } from "next";
import { buildCsp, securityHeaders } from "./src/lib/security/csp";

const dev = process.env.NODE_ENV !== "production";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  // Subresource Integrity keeps pages statically generated while allowing a strict script policy.
  experimental: { sri: { algorithm: "sha256" } },
  async headers() {
    return [
      {
        source: "/((?!_next/static|_next/image|favicon.ico|sw.js).*)",
        headers: [{ key: "Content-Security-Policy", value: buildCsp({ dev, supabaseUrl }) }, ...securityHeaders({ dev })],
      },
      // The service worker must be served from the origin root, never cached long, and never framed.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Content-Type", value: "application/javascript; charset=utf-8" }] },
    ];
  },
};

export default nextConfig;
