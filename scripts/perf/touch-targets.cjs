// Lists interactive elements smaller than 44x44 CSS px at a phone width. Usage:
//   node scripts/perf/touch-targets.cjs http://localhost:3100 [--admin]   (admin needs ADMIN_EMAIL / ADMIN_PASSWORD in the environment)
const { chromium } = require("@playwright/test");
const base = process.argv[2] || "http://localhost:3100";
const admin = process.argv.includes("--admin");
const PUBLIC = ["/en", "/en/cars", "/en/cars/honda-civic", "/en/about", "/en/contact", "/en/login", "/en/register"];
const ADMIN = ["/admin", "/admin/vehicles", "/admin/bookings", "/admin/leads", "/admin/reports", "/admin/audit", "/admin/licences"];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await context.addCookies([{ name: "bc_consent", value: encodeURIComponent(JSON.stringify({ v: "2026-09", analytics: false })), url: base }]);
  const page = await context.newPage();
  if (admin) {
    await page.goto(`${base}/admin/login`);
    await page.getByLabel(/email/i).fill(process.env.ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(process.env.ADMIN_PASSWORD);
    await page.getByRole("button", { name: /log in|sign in/i }).click();
    await page.waitForURL(/\/admin(?!\/login)/, { timeout: 20000 });
  }
  for (const path of admin ? ADMIN : PUBLIC) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const small = await page.evaluate(() => {
      const sel = 'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=menuitem], [role=checkbox], [role=radio], [role=combobox], [role=switch]';
      return [...document.querySelectorAll(sel)]
        .filter((e) => !e.closest(".sr-only") && getComputedStyle(e).visibility !== "hidden")
        .map((e) => ({ e, r: e.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44))
        // Inline links inside a sentence are exempt from the 44px guideline (WCAG 2.5.8 inline exception).
        .filter(({ e }) => !(e.tagName === "A" && e.closest("p, li") && getComputedStyle(e).display === "inline"))
        .map(({ e, r }) => `${e.tagName.toLowerCase()} "${(e.getAttribute("aria-label") || e.textContent || e.getAttribute("placeholder") || "").trim().slice(0, 28)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    });
    console.log(`${path}: ${small.length} small${small.length ? "\n   " + small.slice(0, 8).join("\n   ") : ""}`);
  }
  await browser.close();
})();
