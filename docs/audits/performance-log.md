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

## Third pass, 2026-09-21 (evening): first-load cost

Method: `next experimental-analyze -o` plus `scripts/perf/bundle-composition.cjs` for what each route ships, Lighthouse 12 one run at a time, and `scripts/perf/scroll-frames.cjs` for smoothness.

| Change | Measured effect |
|---|---|
| Mobile menu code loaded on first use (hover, focus or tap of the button) | dialog code out of first load |
| Header renders one language switcher, theme toggle and account menu instead of three (one per breakpoint, two hidden) | 2/3 fewer hydrated controls and DOM nodes |
| Chat loaded when the browser is idle, or at once when a page asks for it (`lazy-chat.tsx`) | launcher and panel out of first load; a request that arrives early opens the chat on mount |
| Vercel Analytics loaded only after consent | out of first load |
| Calendar month and weekday names loaded per language (`calendar-locale.ts`), inside the already-lazy calendar | **74 KB raw (15 KB gzipped) of date data for 11 languages removed from every page's first load** |
| Chinese and Japanese pages use the device's own CJK fonts instead of Noto Sans SC and JP web fonts (`globals.css`); Arabic and Bengali stay web fonts in their own modules | **CSS on every page 304 KB to 120 KB raw; two render-blocking font stylesheets (about 65 KB gzipped) gone** |
| Cookie card given a stable minimum height on phones | mobile vehicle page layout shift 0.034 to 0 on the live site |

First-load JavaScript on the home page: 293 KB to 260 KB gzipped (24 to 21 files). Framework runtime is about 155 KB of what remains.

**Live site after deploy (Measured):**

| Page | Mobile before this pass | Mobile after | Desktop |
|---|---:|---:|---:|
| Home | 81 | **85–86** | 99 |
| Cars | 83 | **86** | not run |
| Vehicle | 75 | **78–80** (best-practices 100, CLS 0) | 96 |
| About | 86 | **91** | not run |

Over the whole recovery: live home mobile 54, then 65, then 81, now 85–86.

**Smoothness (Measured, local production build, 30 wheel steps):** home 0 of 266 frames over 33 ms, cars 0 of 267, vehicle 0 of 258; no long tasks; 95th percentile 16.7 ms. Adding the touches below did not cost any frames.

**Applied throttling (Observed):** with Lighthouse's real network throttling (about 560 ms round trip, 1.4 Mbps) instead of its simulated model, local home mobile first paint is 2.8 s and score 81. Round trips dominate there: connection set-up, HTML, then CSS. Inlining CSS would save one of them but would resend about 45 KB of CSS with every page instead of caching it, so it was not done.

**Not met, still:** mobile 78–91 on the live site, below 95. What is left is mostly the framework runtime (about 155 KB gzipped), Base UI's positioning and menu code that the search bar and header need above the fold, and the slow-network model itself.

**Interaction touches added (CSS only, on the shared timings, off under reduced motion):** the favourite heart pops once when a car is favourited (`heart-pop`, one keyframe, `--motion-medium`) and presses in on tap; the booking total fades in whenever the price changes, so a change is noticed; the card and image lift on hover already existed.
