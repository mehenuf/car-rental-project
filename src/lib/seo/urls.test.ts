import { describe, expect, it } from "vitest";
import { alternatesFor, localizedUrl } from "./urls";

describe("seo urls", () => {
  it("builds localized urls without trailing slashes", () => {
    expect(localizedUrl("de", "/", "https://x.test")).toBe("https://x.test/de");
    expect(localizedUrl("de", "/cars/a/", "https://x.test")).toBe("https://x.test/de/cars/a");
    expect(localizedUrl("en", "about", "https://x.test")).toBe("https://x.test/en/about");
  });
  it("lists every language plus x-default", () => {
    const a = alternatesFor("fr", "/about", "https://x.test");
    expect(a.canonical).toBe("https://x.test/fr/about");
    expect(Object.keys(a.languages)).toHaveLength(12);
    expect(a.languages["x-default"]).toBe("https://x.test/en/about");
  });
});

import { afterEach, vi } from "vitest";
import { siteUrl } from "./urls";

describe("siteUrl", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("prefers the public site url and trims slashes", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://x.test//");
    expect(siteUrl()).toBe("https://x.test");
  });
  it("falls back to the Vercel production host, then localhost", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "bestcar.example");
    expect(siteUrl()).toBe("https://bestcar.example");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(siteUrl()).toBe("http://localhost:3000");
  });
});
