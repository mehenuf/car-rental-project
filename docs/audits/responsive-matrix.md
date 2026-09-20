# Responsive matrix

Measured 2026-09-21 with `scripts/perf/responsive-matrix.cjs` against a local production build. Each cell is "ok" when the page has no horizontal overflow and no visible element outside the viewport (screen-reader-only text excluded).

| Width | /en | /en/cars | /en/cars/honda-civic | /en/about | /en/contact | /en/login | /en/register |
|---|---|---|---|---|---|---|---|
| 320 | ok | ok | ok | ok | ok | ok | ok |
| 360 | ok | ok | ok | ok | ok | ok | ok |
| 375 | ok | ok | ok | ok | ok | ok | ok |
| 414 | ok | ok | ok | ok | ok | ok | ok |
| 480 | ok | ok | ok | ok | ok | ok | ok |
| 768 | ok | ok | ok | ok | ok | ok | ok |
| 834 | ok | ok | ok | ok | ok | ok | ok |
| 1024 | ok | ok | ok | ok | ok | ok | ok |
| 1280 | ok | ok | ok | ok | ok | ok | ok |
| 1440 | ok | ok | ok | ok | ok | ok | ok |
| 1920 | ok | ok | ok | ok | ok | ok | ok |
| 667x375 (landscape phone) | ok | ok | ok | ok | ok | ok | ok |
| 200% zoom of 1280 | ok | ok | ok | ok | ok | ok | ok |

Also covered by Playwright (`e2e/landing.spec.ts`): at 320, 360, 375, 414, 480, 768, 834, 1024, 1280, 1440 and 1920 the city grid has the expected column count (2 below 640, 3 below 1024, 5 above), no clipped card and no page overflow.

## What is not covered
- Touch target sizes were set to 44px on touch screens (CSS `pointer-coarse`) but were **not re-measured** in this batch.
- Keyboard: only the city grid has an automated keyboard test. Other flows were not re-tested by keyboard.
- Screen-reader flow: not tested.
- Reduced motion: the hero has a test that no keyframe animation runs; other pages were not tested.
- Admin pages were not included in the width sweep.
