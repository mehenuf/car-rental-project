import { expect, test, type Page } from "@playwright/test";
import ar from "../src/messages/ar.json";
import { hasSampleData } from "./support";

// Routes, redirects and error outcomes that need no sign-in and write nothing to the database.

async function acceptCookies(page: Page, baseURL: string | undefined) {
  await page.context().addCookies([
    { name: "bc_consent", value: encodeURIComponent(JSON.stringify({ v: "2026-09", analytics: false })), url: baseURL ?? "http://localhost:3210" },
  ]);
}

test.describe("unknown addresses", () => {
  test("a bad path under a language shows the translated 404 inside the site", async ({ page, baseURL }) => {
    await acceptCookies(page, baseURL);
    const response = await page.goto("/en/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page).toHaveTitle(/BestCar/);
  });

  test("the 404 follows the language and direction of the address", async ({ page, baseURL }) => {
    await acceptCookies(page, baseURL);
    const response = await page.goto("/ar/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1, name: ar.notFound.title })).toBeVisible();
  });

  test("an unknown car shows the 404 and tells crawlers not to index it", async ({ page, baseURL }) => {
    // The vehicle page streams behind a loading skeleton, so Next answers 200 and cannot change the status later
    // (documented in next/dist/docs, loading.md, "Status Codes"). The noindex tag is what keeps it out of search.
    await acceptCookies(page, baseURL);
    await page.goto("/en/cars/no-such-car-zzz");
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  });

  test("an unknown booking reference explains itself instead of showing a car 404", async ({ page, baseURL, request }) => {
    const places = await request.get("/api/locations");
    test.skip(!places.ok() || (await places.json()).length === 0, "needs a database");
    await acceptCookies(page, baseURL);
    await page.goto("/en/booking-confirmation?ref=zzzzzz");
    await expect(page.getByRole("heading", { level: 1, name: "We can't find that booking" })).toBeVisible();
    await expect(page.getByRole("link", { name: /bookings/i }).first()).toHaveAttribute("href", /\/account$/);
    await page.goto("/en/checkout/zzzzzz");
    await expect(page.getByRole("heading", { level: 1, name: "We can't find that booking" })).toBeVisible();
  });
});

test.describe("signed-out visitors", () => {
  test("a signed-in-only page sends you to sign in and remembers where you were going", async ({ page, baseURL }) => {
    await acceptCookies(page, baseURL);
    await page.goto("/en/account/driver");
    await expect(page).toHaveURL(/\/en\/login\?next=%2Faccount%2Fdriver$/);
    await expect(page.getByRole("heading", { level: 1, name: "Log in" })).toBeVisible();
  });

  test("the sign-in page does not follow a return address that leaves the site", async ({ page, baseURL }) => {
    await acceptCookies(page, baseURL);
    await page.goto("/en/login?next=https%3A%2F%2Fevil.example");
    await expect(page.getByRole("heading", { level: 1, name: "Log in" })).toBeVisible();
    await expect(page).toHaveURL(/\/en\/login/);
  });

  test("the admin area and the admin APIs are closed", async ({ page, request }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
    for (const path of ["/api/stats", "/api/leads", "/api/bookings"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(401);
    }
  });

  test("robots.txt keeps crawlers out of the language-prefixed private pages", async ({ request }) => {
    const text = await (await request.get("/robots.txt")).text();
    for (const path of ["/en/account", "/de/checkout", "/ar/provider", "/en/booking-confirmation"]) {
      expect(text, path).toContain(`Disallow: ${path}`);
    }
  });
});

test.describe("the cars list", () => {
  test("a page number past the end shows the last page, not an error", async ({ page, baseURL, request }) => {
    const places = await request.get("/api/locations");
    test.skip(!places.ok() || (await places.json()).length === 0, "needs a database with locations");
    await acceptCookies(page, baseURL);
    await page.goto("/en/cars?all=1&page=99");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
    await expect(page.locator("main a[href*='/cars/']").first()).toBeVisible();
  });

  test("a search with a comma in it is an ordinary search", async ({ request }) => {
    const places = await request.get("/api/locations");
    test.skip(!places.ok() || (await places.json()).length === 0, "needs a database with locations");
    for (const search of ["ford, focus", "50%_off", 'a"b', "x,stock.eq.0"]) {
      const response = await request.get(`/api/vehicles?search=${encodeURIComponent(search)}`);
      expect(response.status(), search).toBe(200);
    }
  });

  test("the sort control has a name and the header marks the current page", async ({ page, baseURL, request }) => {
    test.skip(!(await hasSampleData(request)), "needs a database with the sample data");
    await acceptCookies(page, baseURL);
    await page.goto("/en/cars");
    await expect(page.getByRole("combobox", { name: "Sort by" })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link", { name: "Cars", exact: true })).toHaveAttribute("aria-current", "page");
  });
});

test.describe("small interactions", () => {
  test("favouriting a car toggles the heart, and the pop is a one-off", async ({ page, baseURL, request }) => {
    const places = await request.get("/api/locations");
    test.skip(!places.ok() || (await places.json()).length === 0, "needs a database with locations");
    await acceptCookies(page, baseURL);
    await page.goto("/en/cars?all=1");
    const heart = page.getByRole("button", { name: /^Add .* to favorites$/ }).first();
    await heart.click();
    const pressed = page.getByRole("button", { pressed: true, name: /^Remove .* from favorites$/ }).first();
    await expect(pressed).toBeVisible();
    // The pop class is removed when the animation ends, so it never replays on its own.
    await expect(pressed.locator("svg.heart-pop")).toHaveCount(0);
    await pressed.click();
    await expect(page.getByRole("button", { pressed: true, name: /^Remove .* from favorites$/ })).toHaveCount(0);
  });
});

test.describe("host portal language", () => {
  test.use({ locale: "de-DE", extraHTTPHeaders: { "Accept-Language": "de-DE,de;q=0.9" } });

  test("the admin console stays English whatever the browser language", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("the public host application page follows the language in its address", async ({ page, baseURL }) => {
    await acceptCookies(page, baseURL);
    await page.goto("/de/provider/apply");
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    await expect(page.getByRole("heading", { level: 1, name: "Vermieten Sie Ihre Autos über BestCar" })).toBeVisible();
  });
});
