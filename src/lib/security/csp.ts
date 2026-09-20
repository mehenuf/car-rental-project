export interface CspOptions {
  dev: boolean;
  supabaseUrl: string;
  /** Only for dynamically rendered pages, where the proxy can hand each request its own nonce. */
  nonce?: string;
}

/**
 * The Content Security Policy. Scripts come from this site and Stripe; nothing else loads from another host, and
 * framing, plugins and foreign form posts are blocked. Inline scripts are allowed: Next.js writes its bootstrap and
 * page data as inline scripts, and a per-request nonce would force every page to render dynamically (no static
 * generation or CDN caching). Subresource Integrity (enabled in next.config.ts) still protects the script files.
 * Styles allow inline because Tailwind, next/font and the animation library set inline styles.
 */
export function buildCsp({ dev, supabaseUrl, nonce }: CspOptions): string {
  const supabaseWs = supabaseUrl.replace(/^https?:/, "wss:");
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", ...(nonce ? [`'nonce-${nonce}'`] : []), "'unsafe-inline'", "https://js.stripe.com", ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https://images.unsplash.com", "https://*.supabase.co", "https://*.stripe.com"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", supabaseUrl, supabaseWs, "https://api.stripe.com", "https://vitals.vercel-insights.com", ...(dev ? ["ws:", "http:"] : [])],
    "frame-src": ["https://js.stripe.com", "https://hooks.stripe.com"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const parts = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (!dev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

export function securityHeaders({ dev }: { dev: boolean }): { key: string; value: string }[] {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: 'camera=(), microphone=(), geolocation=(self), payment=(self "https://js.stripe.com")' },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
    ...(dev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
  ];
}
