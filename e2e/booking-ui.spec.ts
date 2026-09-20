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
