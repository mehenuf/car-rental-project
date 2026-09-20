// Signed-in admin audit: axe violations, horizontal overflow and screenshots at desktop and phone width. Usage:
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/perf/admin-audit.cjs http://localhost:3100 [outDir]
// Credentials come from the environment and are never stored or printed.
const { chromium } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const fs = require("fs");
const base = process.argv[2] || "http://localhost:3100";
const out = process.argv[3] || "";
const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = process.env;
if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD");
const routes = ["", "/vehicles", "/bookings", "/leads", "/reports", "/audit", "/licences", "/approvals", "/trust", "/providers", "/settings", "/staff"];

(async () => {
  const browser = await chromium.launch();
  for (const [label, viewport, mobile] of [["desktop", { width: 1280, height: 800 }, false], ["phone", { width: 390, height: 844 }, true]]) {
    const context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile });
    await context.addCookies([{ name: "bc_consent", value: encodeURIComponent(JSON.stringify({ v: "2026-09", analytics: false })), url: base }]);
    const page = await context.newPage();
    await page.goto(`${base}/admin/login`, { waitUntil: "networkidle" });
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /log in|sign in/i }).click();
    await page.waitForURL(/\/admin(?!\/login)/, { timeout: 20000 }).catch(() => {});
    for (const route of routes) {
      const url = `${base}/admin${route}`;
      const response = await page.goto(url, { waitUntil: "networkidle" }).catch(() => null);
      const path = new URL(page.url()).pathname;
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
      const rules = axe.violations.map((v) => `${v.id}(${v.nodes.length})`).join(" ");
      if (out) { fs.mkdirSync(out, { recursive: true }); await page.screenshot({ path: `${out}/${label}${route.replace(/\//g, "-") || "-home"}.png`, fullPage: false }); }
      console.log(`${label} /admin${route} ${response?.status()} ${path !== `/admin${route}` ? "-> " + path : ""} overflow ${overflow} axe: ${rules || "clean"}`);
    }
    await context.close();
  }
  await browser.close();
})();
