import { describe, expect, it } from "vitest";
import { buildCsp, securityHeaders } from "./csp";
import { isAllowedOrigin } from "./origin";

describe("buildCsp", () => {
  const csp = buildCsp({ dev: false, supabaseUrl: "https://abc.supabase.co" });
  const directive = (name: string) => csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(name + " ")) ?? "";

  it("blocks framing, plugins and foreign form posts", () => {
    expect(directive("frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive("object-src")).toBe("object-src 'none'");
    expect(directive("base-uri")).toBe("base-uri 'self'");
    expect(directive("form-action")).toBe("form-action 'self'");
    expect(directive("default-src")).toBe("default-src 'self'");
  });
  it("lets Stripe load its script and frames, and the browser reach Supabase", () => {
    expect(directive("script-src")).toContain("https://js.stripe.com");
    expect(directive("frame-src")).toContain("https://js.stripe.com");
    expect(directive("connect-src")).toContain("https://abc.supabase.co");
    expect(directive("connect-src")).toContain("wss://abc.supabase.co");
  });
  it("only allows eval in development, and upgrades insecure requests only in production", () => {
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("upgrade-insecure-requests");
    const dev = buildCsp({ dev: true, supabaseUrl: "https://abc.supabase.co" });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });
  it("allows Next.js inline bootstrap scripts but no other host", () => {
    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://js.stripe.com");
  });
  it("accepts a nonce for dynamically rendered pages", () => {
    expect(buildCsp({ dev: false, supabaseUrl: "https://abc.supabase.co", nonce: "abc123" })).toContain("'nonce-abc123'");
  });
});

describe("securityHeaders", () => {
  it("sets the standard headers, HSTS only in production", () => {
    const prod = Object.fromEntries(securityHeaders({ dev: false }).map((h) => [h.key, h.value]));
    expect(prod["X-Content-Type-Options"]).toBe("nosniff");
    expect(prod["X-Frame-Options"]).toBe("DENY");
    expect(prod["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(prod["Strict-Transport-Security"]).toMatch(/max-age=\d+/);
    expect(prod["Permissions-Policy"]).toContain("camera=()");
    const dev = Object.fromEntries(securityHeaders({ dev: true }).map((h) => [h.key, h.value]));
    expect(dev["Strict-Transport-Security"]).toBeUndefined();
  });
});

describe("isAllowedOrigin", () => {
  it("allows requests with no Origin (servers, webhooks, same-site navigations)", () => {
    expect(isAllowedOrigin(null, "bestcar.example")).toBe(true);
  });
  it("allows the site's own origin, and configured extras", () => {
    expect(isAllowedOrigin("https://bestcar.example", "bestcar.example")).toBe(true);
    expect(isAllowedOrigin("http://localhost:3000", "localhost:3000")).toBe(true);
    expect(isAllowedOrigin("https://www.bestcar.example", "bestcar.example", ["https://www.bestcar.example"])).toBe(true);
  });
  it("refuses another site, a null origin, and lookalikes", () => {
    expect(isAllowedOrigin("https://evil.example", "bestcar.example")).toBe(false);
    expect(isAllowedOrigin("null", "bestcar.example")).toBe(false);
    expect(isAllowedOrigin("https://bestcar.example.evil.example", "bestcar.example")).toBe(false);
    expect(isAllowedOrigin("not a url", "bestcar.example")).toBe(false);
  });
});
