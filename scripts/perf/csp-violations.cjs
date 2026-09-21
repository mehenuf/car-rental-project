// Lists Content-Security-Policy violations the browser reports while a page loads and scrolls. Usage:
//   node scripts/perf/csp-violations.cjs http://localhost:3100 en/cars/honda-civic   (no leading slash on the path)
const { chromium } = require("@playwright/test");
const base = process.argv[2];
const path = "/" + process.argv[3];
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 412, height: 823 } });
  await c.addCookies([{ name: "bc_consent", value: encodeURIComponent(JSON.stringify({ v: "2026-09", analytics: false })), url: base }]);
  const p = await c.newPage();
  let count = 0;
  p.on("console", (m) => { if (m.text().startsWith("CSPV")) { count++; console.log(m.text().slice(0, 300)); } });
  await p.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => console.log("CSPV", e.violatedDirective, "|", e.blockedURI, "|", e.sourceFile, e.lineNumber));
  });
  await p.goto(base + path, { waitUntil: "networkidle" });
  await p.mouse.wheel(0, 3000);
  await p.waitForTimeout(1500);
  console.log(`${path}: ${count} violation(s)`);
  await b.close();
})();
