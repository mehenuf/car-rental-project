import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Serious and critical WCAG A/AA violations fail the build; minor ones are reported but do not.
for (const path of ["/en", "/en/about", "/en/contact", "/en/login", "/en/register", "/en/privacy", "/ar/login"]) {
  test(`${path} has no serious accessibility violations`, async ({ page }) => {
    // Contrast is judged on the settled page, not while the entrance animation is mid-fade.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(blocking.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
  });
}
