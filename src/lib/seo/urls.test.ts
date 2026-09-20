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
