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

**Not met:** Lighthouse mobile performance is 65–73, below the 95 target. The gap is mostly simulated-throttling estimates (observed LCP is under 1s locally and 1.0–2.8s on Vercel). Measured cost that remains: about 380–470KB of JavaScript on first load and three render-blocking CSS files. Vercel needs re-measuring after this batch is deployed.
