# Frontend baseline

Recorded 2026-09-21. Labels: **Measured** (a tool produced the number), **Observed** (seen in a browser), **Inferred**, **Hypothesis**, **Recommendation**.

## Routes
Public: `/[lang]` (home), `/cars`, `/cars/[slug]`, `/cars/in/[city]`, `/about`, `/contact`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/privacy`, `/terms`, `/checkout/[reference]`, `/booking-confirmation`. Customer: `/account/*`, `/dashboard`. Host: `/provider/apply`, `/provider/*`. Staff: `/admin/*` (dashboard, vehicles, bookings, leads, reports, audit, licences, approvals, trust, providers, settings, staff, mfa).

## Measured, production (Vercel), before the hero removal
| Page | Mobile perf | Desktop perf | Notes |
|---|---:|---:|---|
| Home | 54, then 65 after the hydration fix | 96–97 | Hydration error #418 was the largest cost (about 1s of blocking) |
| Cars | 74 | not run | earlier run |
| Vehicle | 67 | not run | SEO 92: meta description missing for ordinary browsers |
| About | 78 | not run | earlier run |

## Measured, local production build, after this batch
See `performance-log.md`.

## Observed
- Home city row scrolled sideways and clipped the fifth card with no cue (fixed: grid).
- Header row was 32px too wide at 320px and 30px too wide at 768px (fixed).
- Chat launcher covered the "Total" price in the vehicle booking panel at 1280px (open, see the AI-slop register).
- Admin: 7 routes loaded logged in, no slow frames; date-range label caused hydration errors (fixed).
