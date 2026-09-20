# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> public pages >> en/about renders with no script errors or CSP violations
- Location: e2e\smoke.spec.ts:9:11

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "Refused to execute script from 'http://localhost:3210/_vercel/insights/script.js' because its MIME type ('text/plain') is not executable, and strict MIME type checking is enabled.",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to main content" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - banner [ref=e3]:
    - generic [ref=e4]:
      - link "BestCar" [ref=e5] [cursor=pointer]:
        - /url: /en
      - navigation [ref=e10]:
        - link "Home" [ref=e11] [cursor=pointer]:
          - /url: /en
        - link "Cars" [ref=e12] [cursor=pointer]:
          - /url: /en/cars
        - link "How It Works" [ref=e13] [cursor=pointer]:
          - /url: /en#how-it-works
        - link "About" [ref=e14] [cursor=pointer]:
          - /url: /en/about
        - link "Contact" [ref=e15] [cursor=pointer]:
          - /url: /en/contact
      - generic [ref=e16]:
        - button "Language" [ref=e17]:
          - generic [ref=e18]: en
        - button "Toggle theme" [ref=e19]
        - link "My Bookings" [ref=e20] [cursor=pointer]:
          - /url: /en/account
        - link "Register" [ref=e21] [cursor=pointer]:
          - /url: /en/register
        - link "Log In" [ref=e22] [cursor=pointer]:
          - /url: /en/login
  - main [ref=e23]:
    - generic [ref=e24]:
      - generic [ref=e25]:
        - heading "Car rental, without the runaround" [level=1] [ref=e26]
        - paragraph [ref=e27]: "BestCar connects renters with a vetted fleet of vehicles in every country we serve. We built the platform we wished existed: clear pricing, a fast booking flow, and no pressure to create an account before you can even see a total."
      - generic [ref=e28]:
        - generic [ref=e34]:
          - heading "Transparent pricing" [level=2] [ref=e35]
          - paragraph [ref=e36]: The price you see on a car's page is the price you pay. No hidden fees added at checkout.
        - generic [ref=e42]:
          - heading "Book in minutes" [level=2] [ref=e43]
          - paragraph [ref=e44]: Pick your dates, confirm your details, and you're done. No account required to get started.
        - generic [ref=e50]:
          - heading "Verified fleet" [level=2] [ref=e51]
          - paragraph [ref=e52]: Every vehicle listed is inspected and insured before it goes live on the platform.
      - generic [ref=e53]:
        - heading "Ready to rent?" [level=2] [ref=e54]
        - paragraph [ref=e55]: Browse the fleet and book the right car for your trip today.
        - link "Browse cars" [ref=e56] [cursor=pointer]:
          - /url: /en/cars
  - contentinfo [ref=e57]:
    - generic [ref=e58]:
      - generic [ref=e59]:
        - generic [ref=e60]:
          - link "BestCar" [ref=e61] [cursor=pointer]:
            - /url: /en
          - paragraph [ref=e66]: Convenient, transparent car rental. Book online in minutes, no account required.
        - generic [ref=e67]:
          - heading "Company" [level=3] [ref=e68]
          - list [ref=e69]:
            - listitem [ref=e70]:
              - link "How it works" [ref=e71] [cursor=pointer]:
                - /url: /en#how-it-works
            - listitem [ref=e72]:
              - link "Browse cars" [ref=e73] [cursor=pointer]:
                - /url: /en/cars
            - listitem [ref=e74]:
              - link "About us" [ref=e75] [cursor=pointer]:
                - /url: /en/about
            - listitem [ref=e76]:
              - link "List your car" [ref=e77] [cursor=pointer]:
                - /url: /en/provider/apply
        - generic [ref=e78]:
          - heading "Support" [level=3] [ref=e79]
          - list [ref=e80]:
            - listitem [ref=e81]:
              - link "Contact us" [ref=e82] [cursor=pointer]:
                - /url: /en/contact
            - listitem [ref=e83]:
              - link "My bookings" [ref=e84] [cursor=pointer]:
                - /url: /en/account
      - generic [ref=e85]:
        - paragraph [ref=e86]: © 2026 BestCar. All rights reserved.
        - generic [ref=e87]:
          - button "Language" [ref=e88]:
            - generic [ref=e89]: en
          - link "Privacy Policy" [ref=e90] [cursor=pointer]:
            - /url: /en/privacy
          - link "Terms & Conditions" [ref=e91] [cursor=pointer]:
            - /url: /en/terms
  - button "Open chat" [ref=e92]
  - alert [ref=e95]
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | const LANGS = ["en", "ar", "de", "ja"] as const;
  4  | const PAGES = ["", "/about", "/contact", "/login", "/register"];
  5  | 
  6  | test.describe("public pages", () => {
  7  |   for (const lang of LANGS) {
  8  |     for (const path of PAGES) {
  9  |       test(`${lang}${path || "/"} renders with no script errors or CSP violations`, async ({ page }) => {
  10 |         const problems: string[] = [];
  11 |         page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  12 |         page.on("console", (m) => {
  13 |           if (m.type() === "error" && /content security policy|refused to (load|execute|connect)/i.test(m.text())) problems.push(m.text());
  14 |         });
  15 | 
  16 |         const response = await page.goto(`/${lang}${path}`);
  17 |         expect(response?.status()).toBe(200);
  18 |         await page.waitForLoadState("networkidle");
  19 | 
  20 |         await expect(page.locator("html")).toHaveAttribute("lang", lang);
  21 |         await expect(page.locator("html")).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
  22 |         await expect(page.locator("h1").first()).toBeVisible();
> 23 |         expect(problems).toEqual([]);
     |                          ^ Error: expect(received).toEqual(expected) // deep equality
  24 |       });
  25 |     }
  26 |   }
  27 | });
  28 | 
  29 | test("security headers are present", async ({ request }) => {
  30 |   const res = await request.get("/en");
  31 |   const headers = res.headers();
  32 |   expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  33 |   expect(headers["x-content-type-options"]).toBe("nosniff");
  34 |   expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  35 | });
  36 | 
  37 | test("an unprefixed path is redirected to a language", async ({ request }) => {
  38 |   const res = await request.get("/about", { maxRedirects: 0 });
  39 |   expect(res.status()).toBe(307);
  40 |   expect(res.headers()["location"]).toMatch(/^\/(en|[a-z]{2})\/about$/);
  41 | });
  42 | 
  43 | test("a cross-site POST to the API is refused", async ({ request }) => {
  44 |   const res = await request.post("/api/quote", { headers: { origin: "https://evil.example" }, data: {} });
  45 |   expect(res.status()).toBe(403);
  46 | });
  47 | 
  48 | test("the language switcher changes language and keeps the page", async ({ page }) => {
  49 |   await page.goto("/en/about");
  50 |   await page.getByRole("button", { name: "Language" }).first().click();
  51 |   await page.getByRole("menuitem", { name: "Deutsch" }).click();
  52 |   await expect(page).toHaveURL(/\/de\/about$/);
  53 |   await expect(page.locator("html")).toHaveAttribute("lang", "de");
  54 | });
  55 | 
```