import { expect, test } from "@playwright/test";

test("the register page lets people choose renter, private owner or company", async ({ page }) => {
  await page.goto("/en/register");
  const group = page.getByRole("radiogroup");
  await expect(group.getByRole("radio")).toHaveCount(3);
  await expect(group.getByRole("radio", { name: /Rent a car/ })).toHaveAttribute("aria-checked", "true");
  await group.getByRole("radio", { name: /List my own car/ }).click();
  await expect(group.getByRole("radio", { name: /List my own car/ })).toHaveAttribute("aria-checked", "true");
  await page.goto("/en/register?type=company");
  await expect(page.getByRole("radio", { name: /rental company/ })).toHaveAttribute("aria-checked", "true");
});

test("the location picker searches as you type and remembers the choice", async ({ page, request }) => {
  const places = await request.get("/api/locations");
  test.skip(!places.ok() || (await places.json()).length === 0, "needs a database with locations");

  await page.goto("/en");
  const chip = page.getByRole("button", { name: /Choose your location/ });
  await chip.click();
  const box = page.getByRole("combobox").last();
  await expect(box).toBeFocused();
  await box.fill("lon");
  const option = page.getByRole("option", { name: /London/ }).first();
  await expect(option).toBeVisible();
  await box.press("ArrowDown");
  await box.press("Enter");
  await expect(chip).toContainText("London");

  await page.goto("/en/cars");
  await expect(page.getByText(/Showing cars in/)).toBeVisible();
  await page.getByRole("link", { name: "Show all locations" }).click();
  await expect(page).toHaveURL(/all=1/);
});

// A page that renders a date on the server must not disagree with the browser about the day, or React throws away
// the server HTML and re-renders everything (a slow, janky load). Check in time zones on both sides of the server's.
for (const timezoneId of ["Pacific/Pago_Pago", "Pacific/Kiritimati"]) {
  test(`the home and car pages hydrate cleanly in ${timezoneId}`, async ({ browser }) => {
    const context = await browser.newContext({ timezoneId });
    const page = await context.newPage();
    const problems: string[] = [];
    page.on("pageerror", (e) => problems.push(e.message));
    for (const path of ["/en", "/en/cars"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }
    expect(problems).toEqual([]);
    await context.close();
  });
}
