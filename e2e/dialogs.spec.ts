import { hasSampleData } from "./support";
import { expect, test, type Locator, type Page } from "@playwright/test";

async function acceptCookies(page: Page, baseURL: string | undefined) {
  await page.context().addCookies([
    { name: "bc_consent", value: encodeURIComponent(JSON.stringify({ v: "2026-09", analytics: false })), url: baseURL ?? "http://localhost:3210" },
  ]);
}

/** Focus must be somewhere inside `container` right now. */
async function expectFocusInside(page: Page, container: Locator) {
  const inside = await container.evaluate((el) => el.contains(document.activeElement));
  expect(inside, "focus should be inside the dialog").toBe(true);
}

/** Tabbing (and shift-tabbing) around a modal must never leave it. */
async function expectFocusTrapped(page: Page, container: Locator) {
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press("Tab");
    await expectFocusInside(page, container);
  }
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Shift+Tab");
    await expectFocusInside(page, container);
  }
}

test.describe("modal dialogs", () => {
  test("the booking dialog takes focus, keeps it, closes on Escape and returns focus", async ({ page, baseURL, request }) => {
    test.skip(!(await hasSampleData(request)), "needs a database with the sample data");
    await acceptCookies(page, baseURL);
    const response = await page.goto("/en/cars/honda-civic");
    test.skip(!response || response.status() !== 200, "needs the sample vehicle");
    const book = page.getByRole("button", { name: "Book Now" });
    await expect(book).toBeEnabled({ timeout: 20000 });
    await book.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expectFocusInside(page, dialog);
    await expectFocusTrapped(page, dialog);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(book).toBeFocused();
  });

  test("the booking dialog keeps focus inside when opened with the mouse too", async ({ page, baseURL, request }) => {
    test.skip(!(await hasSampleData(request)), "needs a database with the sample data");
    await acceptCookies(page, baseURL);
    const response = await page.goto("/en/cars/honda-civic");
    test.skip(!response || response.status() !== 200, "needs the sample vehicle");
    const book = page.getByRole("button", { name: "Book Now" });
    await expect(book).toBeEnabled({ timeout: 20000 });
    await book.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expectFocusTrapped(page, dialog);
  });

  test("the mobile menu is a real dialog: focus moves in, stays in, and returns", async ({ page, baseURL }) => {
    await acceptCookies(page, baseURL);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en");
    const trigger = page.getByRole("button", { name: "Open menu" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expectFocusInside(page, dialog);
    await expectFocusTrapped(page, dialog);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("the mobile filters sheet traps focus and returns it", async ({ page, baseURL, request }) => {
    test.skip(!(await hasSampleData(request)), "needs a database with the sample data");
    await acceptCookies(page, baseURL);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/cars?all=1");
    const trigger = page.getByRole("button", { name: /Filters/ });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expectFocusInside(page, dialog);
    await expectFocusTrapped(page, dialog);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe("menus and popovers", () => {
  test("the language menu opens with the keyboard, moves with arrows and returns focus on Escape", async ({ page, baseURL }) => {
    await acceptCookies(page, baseURL);
    await page.goto("/en");
    await page.waitForLoadState("networkidle");
    const trigger = page.getByRole("button", { name: "Language" }).first();
    await trigger.focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expectFocusInside(page, menu);
    await page.keyboard.press("ArrowDown");
    await expectFocusInside(page, menu);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("the location picker focuses its search box and returns focus on Escape", async ({ page, request, baseURL }) => {
    const places = await request.get("/api/locations");
    test.skip(!places.ok() || (await places.json()).length === 0, "needs a database with locations");
    await acceptCookies(page, baseURL);
    await page.goto("/en");
    const chip = page.getByRole("button", { name: "Choose your location" });
    await chip.focus();
    await page.keyboard.press("Enter");
    const popup = page.locator('[data-slot="popover-content"]');
    const box = popup.getByRole("combobox");
    await expect(box).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden();
    await expect(chip).toBeFocused();
  });

  test("the chat opens with focus inside and returns focus to its button", async ({ page, baseURL }) => {
    await acceptCookies(page, baseURL);
    await page.goto("/en/contact");
    const launcher = page.getByRole("button", { name: "Open chat" });
    await launcher.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: /Assistant/ });
    await expect(dialog).toBeVisible();
    await expectFocusInside(page, dialog);
    await page.getByRole("button", { name: "Close chat" }).click();
    await expect(dialog).toBeHidden();
    await expect(launcher).toBeFocused();
  });
});
