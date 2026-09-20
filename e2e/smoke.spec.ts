import { expect, test } from "@playwright/test";

const LANGS = ["en", "ar", "de", "ja"] as const;
const PAGES = ["", "/about", "/contact", "/login", "/register"];

test.describe("public pages", () => {
  for (const lang of LANGS) {
    for (const path of PAGES) {
      test(`${lang}${path || "/"} renders with no script errors or CSP violations`, async ({ page }) => {
        const problems: string[] = [];
        page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
        page.on("console", (m) => {
          if (m.type() === "error" && /content security policy|refused to (load|execute|connect)/i.test(m.text())) problems.push(m.text());
        });

        const response = await page.goto(`/${lang}${path}`);
        expect(response?.status()).toBe(200);
        await page.waitForLoadState("networkidle");

        await expect(page.locator("html")).toHaveAttribute("lang", lang);
        await expect(page.locator("html")).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
        await expect(page.locator("h1").first()).toBeVisible();
        expect(problems).toEqual([]);
      });
    }
  }
});

test("security headers are present", async ({ request }) => {
  const res = await request.get("/en");
  const headers = res.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
});

test("an unprefixed path is redirected to a language", async ({ request }) => {
  const res = await request.get("/about", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers()["location"]).toMatch(/^\/(en|[a-z]{2})\/about$/);
});

test("a cross-site POST to the API is refused", async ({ request }) => {
  const res = await request.post("/api/quote", { headers: { origin: "https://evil.example" }, data: {} });
  expect(res.status()).toBe(403);
});

test("the language switcher changes language and keeps the page", async ({ page }) => {
  await page.goto("/en/about");
  await page.getByRole("button", { name: "Language" }).first().click();
  await page.getByRole("menuitem", { name: "Deutsch" }).click();
  await expect(page).toHaveURL(/\/de\/about$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
});
