import { expect, test } from "@playwright/test";

// What a screen reader is given: landmarks, the heading outline, accessible names and live regions. This reads the
// accessibility tree the browser builds; it is not a substitute for listening with NVDA, JAWS or VoiceOver.
const PAGES = ["/en", "/en/cars", "/en/cars/honda-civic", "/en/about", "/en/contact", "/en/login", "/en/register", "/en/forgot-password", "/en/terms", "/en/privacy"];

for (const path of PAGES) {
  test(`${path}: landmarks, heading outline and names`, async ({ page, baseURL }) => {
    await page.context().addCookies([
      { name: "bc_consent", value: encodeURIComponent(JSON.stringify({ v: "2026-09", analytics: false })), url: baseURL ?? "http://localhost:3210" },
    ]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const response = await page.goto(path);
    test.skip(!response || response.status() !== 200, "page not available");
    await page.waitForLoadState("networkidle");

    const report = await page.evaluate(() => {
      const visible = (el: Element) => (el as HTMLElement).offsetParent !== null || getComputedStyle(el).position === "fixed";
      const levels = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter(visible).map((h) => Number(h.tagName[1]));
      const skips: string[] = [];
      levels.forEach((level, i) => {
        const before = levels[i - 1];
        if (before !== undefined && level > before + 1) skips.push(`h${before} to h${level}`);
      });
      const nameOf = (el: Element) =>
        (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.textContent || el.querySelector("img[alt]:not([alt=''])")?.getAttribute("alt") || "").trim();
      return {
        h1: levels.filter((l) => l === 1).length,
        skips,
        main: document.querySelectorAll("main").length,
        banner: document.querySelectorAll("header").length,
        footer: document.querySelectorAll("footer:not(article footer, section footer, main footer)").length,
        mainNavNamed: [...document.querySelectorAll("nav")].some((n) => n.getAttribute("aria-label") === "Main"),
        unnamedControls: [...document.querySelectorAll("a[href], button")].filter((el) => visible(el) && !nameOf(el)).length,
        unlabelledFields: [...document.querySelectorAll("input:not([type=hidden]), select, textarea")]
          .filter((i) => visible(i) && !(i as HTMLInputElement).labels?.length && !i.getAttribute("aria-label") && !i.getAttribute("aria-labelledby") && !/hidden-input/.test(i.id + (i as HTMLInputElement).name))
          .length,
        imagesWithoutAlt: document.querySelectorAll("img:not([alt])").length,
        langSet: Boolean(document.documentElement.lang),
      };
    });

    expect(report.h1, "exactly one h1").toBe(1);
    expect(report.skips, "heading levels never skip").toEqual([]);
    expect([report.main, report.banner, report.footer], "one main, banner and footer").toEqual([1, 1, 1]);
    expect(report.mainNavNamed, "the main navigation is named").toBe(true);
    expect(report.unnamedControls, "links and buttons have names").toBe(0);
    expect(report.unlabelledFields, "form fields have labels").toBe(0);
    expect(report.imagesWithoutAlt, "images have alt text (empty for decorative)").toBe(0);
    expect(report.langSet).toBe(true);
  });
}

test("the cars list announces its result count", async ({ page, baseURL }) => {
  await page.context().addCookies([
    { name: "bc_consent", value: encodeURIComponent(JSON.stringify({ v: "2026-09", analytics: false })), url: baseURL ?? "http://localhost:3210" },
  ]);
  await page.goto("/en/cars?all=1");
  await expect(page.getByRole("status").filter({ hasText: /cars? found/ })).toHaveCount(1);
});
