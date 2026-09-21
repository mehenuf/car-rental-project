# Performance log

Lighthouse 12 (default mobile emulation with simulated throttling; desktop preset), Chromium, on a Windows development machine. The "simulated" LCP is Lighthouse's estimate for a slow phone; "observed" is the LCP Chromium actually recorded. Numbers vary by several points between runs.

| Date | Target | Page | Mobile perf | Desktop perf | Mobile LCP sim / obs | Mobile TBT | Notes |
|---|---|---|---:|---:|---|---:|---|
| 09-21 | Vercel | Home | 54 | 97 | 5.9s / 1.6s | 1,000ms | Hydration error #418 |
| 09-21 | Vercel | Home | 65 | 96 | 5.6s / 2.8s | 390ms | After the time-zone fix |
| 09-21 | Vercel | Vehicle | 67 | not run | 6.2s / 2.5s | 330ms | |
| 09-21 | Local | Home | 73 | 95 | 7.0s / 0.77s | 200ms | After hero removal |
| 09-21 | Local | Vehicle | 70 | not run | 8.2s / 1.1s | 240ms | SEO 100 after blocking metadata; best-practices 96 (`inspector-issues`, not investigated) |

Scroll frames (`scripts/perf/scroll-frames.cjs`, 30 wheel steps plus pointer moves, Chromium): home before 38 slow of 293 frames (95th percentile 50ms); home after 0 of 264; cars 0 of 262; vehicle 1 of 256.

| 09-21 | Local | Home | 71–73 | not run | 6.3–7.2s / 0.6–0.7s | 220–250ms | Auth library (64KB gz) moved out of the first script set; no measurable Lighthouse change, first-load script set is smaller |

**Not met:** Lighthouse mobile performance is 65–73, below the 95 target. The gap is mostly simulated-throttling estimates (observed LCP is under 1s locally and 1.0–2.8s on Vercel). Measured cost that remains: about 380–470KB of JavaScript on first load and three render-blocking CSS files. Vercel needs re-measuring after this batch is deployed.

## Second pass, 2026-09-21 (afternoon)

Measured with Lighthouse 12 (default mobile emulation and simulated throttling; desktop preset) against a local production build and the deployed site, one run at a time so runs do not compete.

| Target | Page | Mobile perf | Desktop perf | Mobile LCP (simulated) | TBT | Notes |
|---|---|---:|---:|---|---:|---|
| Local | Home | 71 | 98 | 7.0s | 250ms | Before the font change |
| Local | Home | 77–79 | 98 | 5.0s | 170–210ms | After the fonts change |
| Local | Cars / Vehicle / About | 76 / 74 / 78 | not run | 6.1s / 5.6s / 5.4s | 140 / 260 / 150ms | After the fonts change |
| **Vercel** | Home | **81** (was 54, then 65) | **99** | 4.2s | 180–220ms | Deployed 3:13 pm |
| **Vercel** | Cars | 83 | not run | 4.3s | 100ms | |
| **Vercel** | Vehicle | 75 | 97 | 4.9s | 250ms | best-practices 96: see below |
| **Vercel** | About | 86 | not run | 4.0s | 90ms | |

**Root cause found (Measured):** every page, in every language, preloaded four font files at high priority, including Noto Sans Arabic (163 KB) and Noto Sans Bengali (106 KB), so an English visitor fetched 270 KB of fonts they could not use beside the 13 KB hero photo. The 2026-09-21 morning claim of "two font preloads" was wrong for those two script fonts. Setting `preload: false` on them cut English pages to two preloads (Inter and Sora) and moved local home mobile from 71 to 77–79 and Vercel home from 65 to 81.

**Also (Measured):** the vehicle page logged a Content-Security-Policy violation for `eval` (Zod 4 probes `new Function`), which cost 4 points of best-practices. Fixed by turning JIT off in the browser (`z.config({ jitless: true })`); `scripts/perf/csp-violations.cjs` now reports 0 on four pages. Removing the react-dom hero preload changed the score by less than the run-to-run spread (76–78 either way), so it was kept out for simplicity.

**Observed:** in an unthrottled Chromium trace the home page paints its first content and its LCP image at 158 ms. Lighthouse's own run shows 630–715 ms because of its tracing overhead, and its simulated LCP (4–5 s) is a model of a slow phone: it counts all first-load JavaScript (331 KB gzipped in 25 files, about 153 KB of it framework runtime) at a 4x CPU slowdown.

**Not met, still:** mobile Lighthouse performance is 74–86 on the live site, below the 95 target. Reaching 95 on this model would mean shipping much less JavaScript before first paint (for example rendering more of the home page without client components), which is a larger change than this pass and was not attempted. Desktop is 97–99.

**Server response time on the live site (Measured, 5 warm requests each, 2026-09-21 after the round-trip change):** cars 0.38 to 0.47 s to first byte (one 0.88 s outlier), vehicle page 0.62 to 0.66 s (one 1.04 s outlier). A cold request took 1.8 to 2.3 s. There is no warm "before" figure to compare against, so this is a record, not proof that the change helped. The change itself is structural: card lists read branches in the same round trip instead of a third dependent one, the vehicle page fetches its translation in parallel, and the cars page looks up the place while it fetches the list. With the function in Washington and the database elsewhere, each removed round trip is worth the full distance; pinning the function region next to the database (needs the Supabase region) is still the larger fix.
