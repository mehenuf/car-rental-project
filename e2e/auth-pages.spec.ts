import { expect, test, type Page } from "@playwright/test";

// The sign-in, sign-up and password-recovery screens. Nothing here creates an account or signs anyone in.

async function acceptCookies(page: Page, baseURL: string | undefined) {
  await page.context().addCookies([
    { name: "bc_consent", value: encodeURIComponent(JSON.stringify({ v: "2026-09", analytics: false })), url: baseURL ?? "http://localhost:3210" },
  ]);
}

test.describe("titles", () => {
  for (const [path, title] of [
    ["/en/login", "Sign in | BestCar"],
    ["/en/register", "Create account | BestCar"],
    ["/en/forgot-password", "Forgot password | BestCar"],
    ["/en/reset-password", "Choose a new password | BestCar"],
    ["/de/forgot-password", "Passwort vergessen | BestCar"],
  ] as const) {
    test(`${path} says what it is in the tab`, async ({ page, baseURL }) => {
      await acceptCookies(page, baseURL);
      await page.goto(path);
      await expect(page).toHaveTitle(title);
    });
  }
});

test.describe("sign up", () => {
  test("links the terms and the privacy policy before you create an account", async ({ page, baseURL }) => {
    await acceptCookies(page, baseURL);
    await page.goto("/en/register");
    const notice = page.getByText(/By creating an account you accept/);
    await expect(notice).toBeVisible();
    await expect(notice.getByRole("link", { name: "Terms and conditions" })).toHaveAttribute("href", /\/terms$/);
    await expect(notice.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", /\/privacy$/);
  });

  test("the account type choice works with the arrow keys, like a native radio group", async ({ page, baseURL }) => {
    await acceptCookies(page, baseURL);
    await page.goto("/en/register");
    const radios = page.getByRole("radio");
    await expect(radios).toHaveCount(3);
    await expect(radios.nth(0)).toHaveAttribute("aria-checked", "true");
    // Only the selected option is a tab stop.
    await expect(radios.nth(1)).toHaveAttribute("tabindex", "-1");
    await radios.nth(0).focus();
    await page.keyboard.press("ArrowDown");
    await expect(radios.nth(1)).toHaveAttribute("aria-checked", "true");
    await expect(radios.nth(1)).toBeFocused();
    await page.keyboard.press("End");
    await expect(radios.nth(2)).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("ArrowRight");
    await expect(radios.nth(0)).toHaveAttribute("aria-checked", "true");
  });

  test("a name of only spaces is refused with a reason, before anything is sent", async ({ page, baseURL }) => {
    await acceptCookies(page, baseURL);
    let signupCalls = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/auth/signup")) signupCalls++;
    });
    await page.goto("/en/register");
    await page.getByLabel("Full name").fill("   ");
    await page.getByLabel("Email").fill("someone@example.com");
    await page.getByLabel("Password", { exact: true }).fill("a-long-enough-password");
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page.locator("p[role=alert]")).toHaveText("Enter your full name.");
    expect(signupCalls).toBe(0);
  });
});

test.describe("password recovery", () => {
  test("an expired reset link offers a way forward, not a dead end", async ({ page, baseURL }) => {
    await acceptCookies(page, baseURL);
    await page.goto("/en/reset-password");
    await expect(page.getByRole("heading", { level: 1, name: "This link has expired" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Request a new link" })).toHaveAttribute("href", /\/forgot-password$/);
  });

  test("the forgot-password form asks for an email and nothing else", async ({ page, baseURL }) => {
    await acceptCookies(page, baseURL);
    await page.goto("/en/forgot-password");
    await expect(page.getByRole("heading", { level: 1, name: "Reset your password" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: /Send/ })).toBeVisible();
  });
});

test.describe("the legal pages match the product", () => {
  test("terms describe a marketplace with in-app cancellation and simulated payments", async ({ page, baseURL }) => {
    await acceptCookies(page, baseURL);
    await page.goto("/en/terms");
    const text = await page.locator("main").innerText();
    expect(text).toMatch(/marketplace/i);
    expect(text).toMatch(/simulated/i);
    expect(text).toMatch(/My bookings/);
    expect(text).not.toMatch(/contacting us with your booking reference/i);
  });

  test("privacy points to the self-service tools, not to an address that does not exist", async ({ page, baseURL }) => {
    await acceptCookies(page, baseURL);
    await page.goto("/en/privacy");
    const text = await page.locator("main").innerText();
    expect(text).toMatch(/download a copy of your data/i);
    expect(text).toMatch(/delete your account/i);
    expect(text).not.toMatch(/by contacting us/i);
    expect(text).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i);
  });
});

test.describe("the cookie card", () => {
  test("is a slim bar at the bottom on wide screens, so it does not cover the page", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en/about");
    const banner = page.locator("[data-consent-banner]");
    await expect(banner).toBeVisible();
    const box = await banner.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(1200);
    expect(box!.height).toBeLessThan(120);
    expect(Math.round(box!.y + box!.height)).toBe(800);
  });

  test("sits under the open menu on a phone so the menu stays usable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en");
    await page.getByRole("button", { name: /menu/i }).click();
    const menu = page.getByRole("dialog");
    await expect(menu).toBeVisible();
    const login = menu.getByRole("link", { name: "Log in" });
    await expect(login).toBeVisible();
    const box = await login.boundingBox();
    const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest("a")?.getAttribute("href") ?? "", {
      x: box!.x + box!.width / 2,
      y: box!.y + box!.height / 2,
    });
    expect(hit).toMatch(/\/login$/);
  });
});
