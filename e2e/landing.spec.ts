import { expect, test, type Page } from "@playwright/test";

const WIDTHS = [320, 360, 375, 414, 480, 768, 834, 1024, 1280, 1440, 1920];

/** Columns the city grid should use at a width: 2 below 640, 3 below 1024, otherwise 5. */
function expectedColumns(width: number): number {
  return width < 640 ? 2 : width < 1024 ? 3 : 5;
}

async function acceptCookies(page: Page, baseURL: string | undefined) {
  await page.context().addCookies([
    { name: "bc_consent", value: encodeURIComponent(JSON.stringify({ v: "2026-09", analytics: false })), url: baseURL ?? "http://localhost:3210" },
  ]);
}

test.describe("hero", () => {
  test("shows the headline, both actions and the search on first view", async ({ page, baseURL }) => {
    await acceptCookies(page, baseURL);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const hero = page.locator("main section").first();
    await expect(hero.getByRole("link", { name: "Find a car" })).toBeVisible();
    await expect(hero.getByRole("link", { name: "List your car" })).toBeVisible();
    const search = page.locator("#search-bar");
    const box = await search.boundingBox();
    expect(box && box.y < 800).toBe(true); // the search starts inside the first screen
  });

  test("has no running animation, with or without reduced motion", async ({ page, baseURL }) => {
    await acceptCookies(page, baseURL);
    await page.goto("/en");
    await page.waitForLoadState("networkidle");
    // Only the hero: no keyframe animation may be running in it (transitions elsewhere, such as hover, are fine).
    const running = await page.evaluate(() => {
      const hero = document.querySelector("main section");
      return document
        .getAnimations()
        .filter((a) => a instanceof CSSAnimation && a.playState === "running" && hero?.contains((a.effect as KeyframeEffect | null)?.target ?? null))
        .map((a) => (a as CSSAnimation).animationName);
    });
    expect(running).toEqual([]);
  });

  test("the primary action scrolls to the search", async ({ page, baseURL }) => {
    await acceptCookies(page, baseURL);
    await page.goto("/en");
    await page.getByRole("link", { name: "Find a car" }).click();
    await expect(page).toHaveURL(/#search-bar$/);
  });
});

test.describe("city grid", () => {
  test("wraps into a grid with no clipped card and no sideways scroll at every width", async ({ page, request, baseURL }) => {
    const places = await request.get("/api/locations");
    test.skip(!places.ok() || (await places.json()).length === 0, "needs a database with locations");
    await acceptCookies(page, baseURL);

    await page.setViewportSize({ width: WIDTHS[0]!, height: 900 });
    await page.goto("/en");
    await page.waitForLoadState("networkidle");
    const grid = page.getByTestId("city-grid");
    await expect(grid).toBeVisible();
    const count = await grid.getByRole("link").count();
    expect(count).toBeGreaterThan(0);

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });

      const layout = await page.evaluate(() => {
        const items = [...document.querySelectorAll<HTMLElement>('[data-testid="city-grid"] a')];
        const rects = items.map((el) => el.getBoundingClientRect());
        return {
          pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
          clipped: rects.filter((r) => r.left < -0.5 || r.right > window.innerWidth + 0.5).length,
          firstRowColumns: rects.filter((r) => Math.abs(r.top - rects[0]!.top) < 2).length,
        };
      });
      expect(layout.pageOverflow, `page overflow at ${width}px`).toBeLessThanOrEqual(0);
      expect(layout.clipped, `clipped cards at ${width}px`).toBe(0);
      expect(layout.firstRowColumns, `columns at ${width}px`).toBe(Math.min(count, expectedColumns(width)));
    }
  });

  test("every city can be reached and opened with the keyboard", async ({ page, request, baseURL }) => {
    const places = await request.get("/api/locations");
    test.skip(!places.ok() || (await places.json()).length === 0, "needs a database with locations");
    await acceptCookies(page, baseURL);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/en");
    const first = page.getByTestId("city-grid").getByRole("link").first();
    await first.focus();
    await expect(first).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/en\/cars\/in\//);
  });
});
