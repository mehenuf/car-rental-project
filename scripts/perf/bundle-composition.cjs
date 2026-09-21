// Which first-load chunks a route ships, how big they are, and which libraries they contain. Needs a build and
// `next experimental-analyze -o` (writes .next/diagnostics/route-bundle-stats.json). Usage:
//   node scripts/perf/bundle-composition.cjs [route]      route defaults to /[lang]
const fs = require("fs");
const zlib = require("zlib");
const route = process.argv[2] || "/[lang]";
const stats = require("../../.next/diagnostics/route-bundle-stats.json");
const entry = stats.find((x) => x.route === route);
if (!entry) throw new Error("route not found: " + route);
const KEYS = {
  "react-dom": "hydrateRoot",
  "next-router": "AppRouterContext",
  "base-ui": "base-ui",
  "floating-ui": "floating-ui",
  supabase: "GoTrueClient",
  zod: "ZodError|\\$ZodType",
  lucide: "lucide",
  "vercel-analytics": "vercel-scripts|va\\.vercel",
  "next-themes": "next-themes",
  "day-picker": "DayPicker|rdp-",
  "tw-animate": "animate-in",
};
let raw = 0;
let gz = 0;
const rows = [];
for (const p of entry.firstLoadChunkPaths) {
  const file = p.split("\\").join("/");
  if (!file.endsWith(".js") || !fs.existsSync(file)) continue;
  const buf = fs.readFileSync(file);
  const text = buf.toString("utf8");
  const z = zlib.gzipSync(buf).length;
  raw += buf.length;
  gz += z;
  const hits = Object.entries(KEYS).filter(([, re]) => new RegExp(re).test(text)).map(([k]) => k);
  rows.push([z, buf.length, file.split("/").pop(), hits.join(",")]);
}
rows.sort((a, b) => b[0] - a[0]);
console.log(`${route}: ${rows.length} chunks, ${Math.round(raw / 1024)} KB raw, ${Math.round(gz / 1024)} KB gzipped`);
for (const r of rows.slice(0, 16)) console.log(`${String(Math.round(r[0] / 1024)).padStart(4)} KB gz ${String(Math.round(r[1] / 1024)).padStart(4)} KB raw  ${r[2].padEnd(22)} ${r[3]}`);
