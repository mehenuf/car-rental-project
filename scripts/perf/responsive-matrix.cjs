// Measures horizontal overflow and clipped elements for key pages at the widths in the responsive matrix.
// Usage: node scripts/perf/responsive-matrix.cjs http://localhost:3100   (prints a markdown table)
const { chromium } = require("@playwright/test");
const base = process.argv[2] || "http://localhost:3100";
const PAGES = ["/en", "/en/cars", "/en/cars/honda-civic", "/en/about", "/en/contact", "/en/login", "/en/register"];
const SIZES = [
  ["320", 320, 800], ["360", 360, 800], ["375", 375, 812], ["414", 414, 896], ["480", 480, 900],
  ["768", 768, 1024], ["834", 834, 1112], ["1024", 1024, 768], ["1280", 1280, 800], ["1440", 1440, 900], ["1920", 1920, 1080],
  ["667x375 (landscape phone)", 667, 375], ["200% zoom of 1280", 640, 400],
];

(async () => {
  const browser = await chromium.launch();
  const rows = [];
  for (const [label, width, height] of SIZES) {
    const cells = [];
    for (const path of PAGES) {
      const context = await browser.newContext({ viewport: { width, height } });
      await context.addCookies([{ name: "bc_consent", value: encodeURIComponent(JSON.stringify({ v: "2026-09", analytics: false })), url: base }]);
      const page = await context.newPage();
      await page.goto(base + path, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => {
        const vw = window.innerWidth;
        const over = document.documentElement.scrollWidth - vw;
        const clipped = [...document.querySelectorAll("body *")].filter((e) => {
          const b = e.getBoundingClientRect();
          return b.width > 0 && (b.right > vw + 0.5 || b.left < -0.5) && !e.closest("[aria-hidden=true], .sr-only");
        }).length;
        return { over, clipped };
      });
      cells.push(r.over > 0 || r.clipped > 0 ? `**${r.over}px / ${r.clipped}**` : "ok");
      await context.close();
    }
    rows.push(`| ${label} | ${cells.join(" | ")} |`);
  }
  console.log(`| Width | ${PAGES.join(" | ")} |\n|---|${PAGES.map(() => "---").join("|")}|\n${rows.join("\n")}`);
  await browser.close();
})();
