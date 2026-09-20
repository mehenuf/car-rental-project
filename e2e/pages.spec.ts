import { expect, test, type Page } from "@playwright/test";

async function acceptCookies(page: Page, baseURL: string | undefined) {
  await page.context().addCookies([
    { name: "bc_consent", value: encodeURIComponent(JSON.stringify({ v: "2026-09", analytics: false })), url: baseURL ?? "http://localhost:3210" },
  ]);
}

test.describe("contact", () => {
  test("names the real channels and shows no invented contact details", async ({ page, baseURL }) => {
    await acceptCookies(page, baseURL);
    await page.goto("/en/contact");
    await expect(page.getByRole("heading", { level: 1, name: "Contact" })).toBeVisible();
    const main = page.locator("main");
    await expect(main.getByText("There is no support email address or phone line yet.")).toBeVisible();
    const text = await main.innerText();
    expect(text).not.toMatch(/\.example|@[a-z0-9-]+\.[a-z]{2,}|\+\d{1,3}[ \d]{7,}/i);
    await expect(main.getByRole("link", { name: /A problem with a booking/ })).toHaveAttribute("href", /\/account$/);
    await expect(main.getByRole("link", { name: /You are a host/ })).toHaveAttribute("href", /\/provider$/);
  });

  test("the assistant row opens the chat", async ({ page, baseURL }) => {
    await acceptCookies(page, baseURL);
    await page.goto("/en/contact");
    await page.getByRole("button", { name: /Ask the assistant/ }).click();
    await expect(page.getByRole("dialog", { name: /Assistant/ })).toBeVisible();
  });
});

test.describe("about", () => {
  test("explains renting and listing, and claims nothing the product does not do", async ({ page, baseURL }) => {
    await acceptCookies(page, baseURL);
    await page.goto("/en/about");
    await expect(page.getByRole("heading", { level: 1, name: "How BestCar works" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "If you rent" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "If you list a car" })).toBeVisible();
    await expect(page.locator("main h3")).toHaveCount(6);
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/inspected and insured|vetted fleet/i);
  });
});

test.describe("vehicle page", () => {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    test(`the chat button never covers the price at ${viewport.width}px`, async ({ page, baseURL }) => {
      await acceptCookies(page, baseURL);
      await page.setViewportSize(viewport);
      const response = await page.goto("/en/cars/honda-civic");
      test.skip(!response || response.status() !== 200, "needs the sample vehicle");
      await expect(page.getByText("Total", { exact: true })).toBeVisible({ timeout: 15000 });
      await page.getByText("Total", { exact: true }).scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      const covered = await page.evaluate(() => {
        const launcher = document.querySelector<HTMLElement>('button[aria-label^="Open chat"]');
        if (!launcher || getComputedStyle(launcher).opacity === "0") return false;
        const l = launcher.getBoundingClientRect();
        return [...document.querySelectorAll<HTMLElement>("[data-chat-avoid]")].some((el) => {
          const r = el.getBoundingClientRect();
          return l.left < r.right && l.right > r.left && l.top < r.bottom && l.bottom > r.top;
        });
      });
      expect(covered).toBe(false);
    });
  }

  test("does not show the placeholder description", async ({ page, baseURL }) => {
    await acceptCookies(page, baseURL);
    const response = await page.goto("/en/cars/honda-civic");
    test.skip(!response || response.status() !== 200, "needs the sample vehicle");
    await expect(page.locator("main")).not.toContainText("well maintained and ready for your next trip");
  });
});

test("car cards say where the car is offered", async ({ page, request, baseURL }) => {
  const places = await request.get("/api/locations");
  test.skip(!places.ok() || (await places.json()).length === 0, "needs a database with locations");
  await acceptCookies(page, baseURL);
  await page.goto("/en/cars?all=1");
  const cities = ((await (await request.get("/api/locations")).json()) as { city: string }[]).map((p) => p.city);
  const firstCard = page.locator("main div.group").first();
  await expect(firstCard).toContainText(new RegExp(cities.join("|")));
});
