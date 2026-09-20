// Read-only check of the signed-in admin experience on a deployed site. Usage:
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/perf/admin-smoke.cjs https://your-site
// Credentials come from the environment and are never stored.
const { chromium } = require("@playwright/test");
const base = process.argv[2];
const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = process.env;
if (!base || !email || !password) throw new Error("Give the site URL and set ADMIN_EMAIL and ADMIN_PASSWORD");

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 100)));
  page.on("response", (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url().slice(-60)}`); });
  await page.goto(`${base}/admin/login`, { waitUntil: "networkidle" });
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.waitForURL(/\/admin(?!\/login)/, { timeout: 20000 }).catch(() => {});
  console.log("after login:", new URL(page.url()).pathname);
  const routes = ["/admin", "/admin/vehicles", "/admin/bookings", "/admin/leads", "/admin/reports", "/admin/audit", "/admin/licences"];
  for (const route of routes) {
    const started = Date.now();
    const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle" }).catch(() => null);
    const frames = await page.evaluate(async () => {
      const deltas = [];
      let last = performance.now();
      await new Promise((resolve) => {
        const end = performance.now() + 1200;
        const loop = (t) => { deltas.push(t - last); last = t; t < end ? requestAnimationFrame(loop) : resolve(); };
        requestAnimationFrame(loop);
        window.scrollBy(0, 400);
      });
      deltas.sort((a, b) => a - b);
      return { p95: Math.round(deltas[Math.floor(deltas.length * 0.95)] || 0), slow: deltas.filter((d) => d > 33).length };
    });
    console.log(`${route} -> ${new URL(page.url()).pathname} status ${response?.status()} load ${Date.now() - started}ms frame p95 ${frames.p95}ms slow ${frames.slow}`);
  }
  console.log("errors:", errors.length ? errors : "none");
  await browser.close();
})();
