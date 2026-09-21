# HANDOFF: BestCar car-rental marketplace

**Purpose.** A complete, honest memory of the project so a different person, AI model or session can continue without re-deriving anything. Written 2026-09-21 at commit `d4ddfeb` (branch `main`, 145 commits). Nothing secret is in this file. If something here disagrees with the code, the code wins; fix this file.

**Read in this order:** section 1 (what it is), section 2 (rules you must follow), section 8 (what to do next), then the rest as needed. The deeper records are in `docs/` (section 10).

---

## 1. What this is

BestCar is a multi-provider car-rental marketplace: renters search and book, hosts (rental companies with branches, and private owners) list cars, platform staff approve and oversee. It is also a technical assessment submission ("Digital Pylot": web design/development plus an AI and automation role), so craft and correctness both matter.

- **Live site:** https://car-rental-project-mehenuf.vercel.app/ (Vercel, auto-deploys from `main`). Repo: `github.com/mehenuf/car-rental-project` (public).
- **Stack:** Next.js 16.3.3 (App Router, `proxy.ts`, async params; **not the Next.js in most training data**: read `node_modules/next/dist/docs/` before assuming an API), React 19, TypeScript strict, Tailwind v4 (tokens in `src/app/globals.css`), shadcn on **Base UI** (`render`, not `asChild`), Supabase (Postgres, Auth, Storage, RLS), Zod 4, Vitest, Playwright, custom SQL test runner.
- **Infra:** Supabase project in `ap-northeast-1` (Tokyo). Vercel functions pinned to `hnd1` (Tokyo) in `vercel.json`. CI: GitHub Actions `.github/workflows/ci.yml` (typegen, tsc, lint, vitest with coverage, SQL tests on Postgres 16, build, Playwright). No `gh` CLI on the owner's machine; read CI through the public API (`api.github.com/repos/mehenuf/car-rental-project/actions/runs`).
- **Languages:** 11 (`en ar bn de es fr id ja nl pt zh`), messages in `src/messages/*.json`, custom i18n (`src/lib/i18n/*`), Arabic is right-to-left.
- **Payments and payouts are SIMULATED.** Stripe, if configured, is test mode only. Email, SMS and web push are optional and off unless configured. There is **no real support email or phone**; Contact is chat-only and says so.
- **Data:** the database holds seeded demo data: 24 cars, 207 bookings, 60 reviews. The owner decided (2026-09-21) to treat these as real for now and replace them later; they are not labelled as samples. See `docs/DECISIONS.md`.

## 2. Rules from the owner (follow these)

1. **Commits are authored as the owner** (git user is already configured) with **no AI attribution**: no Co-Authored-By trailer, no "Generated with" line, no session links. Push to `main`.
2. **Credentials never go into files, tests, docs, fixtures, logs, screenshots or chat output.** A secondary staff test account exists on the live database; its credentials are supplied by the owner and may only be passed as environment variables (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) to local scripts (`scripts/perf/admin-audit.cjs`, `admin-smoke.cjs`, `touch-targets.cjs --admin`). Local scripts that read `.env.local` (Supabase keys) must never print values. Never run anything against real Stripe, Resend or Twilio.
3. **Be honest.** Label findings Measured, Observed, Inferred, Hypothesis or Recommendation. Never claim a test, skill, screenshot or score that did not happen. Say what was not run. The owner explicitly wants "what was not done" stated.
4. **Only claim what the product does.** No invented reviews, statistics, trust badges, contact details or "inspected and insured" claims. Simulated payments are stated in the footer and terms.
5. **Calm, fast, accessible design.** No parallax, scroll-scrubbed animation, pointer effects, canvas, backdrop blur, cinematic effects, smooth-scroll libraries. Motion is short CSS on shared tokens and off for reduced motion. Preserve verified earlier work unless measured otherwise.
6. **Small, tested commits; verify before claiming done.** Run types, lint, unit, browser tests, and measure performance changes before and after.
7. **Gitignored local files** (only on the owner's machine, not in the repo): `CLAUDE.md`, `AGENTS.md` (says the Next.js here has breaking changes), `PRODUCT.md`, `DESIGN.md`, `PROJECT_CONTEXT.md`, `.claude/`, `.env.local`. Their essentials are folded into this file; do not commit them.
8. Ask the owner before anything hard to reverse or outward-facing that they have not approved (for example applying SQL to the production database: they ran migration 0018 themselves).

## 3. State right now (2026-09-21, commit `d4ddfeb`)

| Area | State |
|---|---|
| Types / lint | `tsc` 0 errors; eslint 0 errors (1 harmless warning from generated coverage output) |
| Unit tests | 618 pass (Vitest, 71 files) |
| Browser tests | 99 pass locally; in CI (no database) 76 pass and 23 skip by design |
| CI on `main` | Green at `d4ddfeb`. It was red for about a dozen runs before `9e69462` (see lessons) |
| SQL tests | 16 test files plus helpers, pass in CI on Postgres 16 (not runnable on the owner's machine: no local PostgreSQL) |
| Migrations | `0001` to `0018` written; **all applied to production** (0018 on 2026-09-21, verified: public key gets "permission denied" on `daily_stats`, `v_best_sellers`, `v_sales_by_country`) |
| Lighthouse mobile (live) | home 85-86, cars 86, vehicle 78-80, about 91. **Target 95 NOT met.** Desktop 96-99. (Started at 54 for home) |
| Smoothness | 0 slow frames of about 260 while scrolling home, cars, vehicle; no long tasks |
| Accessibility | axe clean on public pages and 12 admin pages at 1280 and 390 px; touch targets 44 px on coarse pointers; keyboard, focus trap, reduced motion checked. **No real screen-reader session has been run** |
| Responsive | 14 pages by 13 sizes, no overflow (`scripts/perf/responsive-matrix.cjs`) |
| Audit findings | 110 findings in `docs/audits/findings-register.md`: 66 fixed, 17 partly, 2 accepted, 25 open (all open items are P2) |
| Server speed | Warm first byte on live: cars 0.35-0.45 s, vehicle page 0.36-0.46 s after the Tokyo region pin. Cold requests were 1.8-2.3 s before the pin and were not re-measured |

## 4. History of the work (what was done, in order)

**Background (before this recovery):** the product was built in sub-projects: marketplace core, fleet units with database-enforced availability, booking lifecycle, pricing engine, payments provider layer with append-only ledger, provider portal, customer account and trust, communications (email, SMS, push), reviews and disputes, platform admin, compliance docs, retention, 11 languages, AI chat grounded in live inventory, location picker, README and `docs/` rewrite.

**Recovery, driven by two owner prompts** (the "Master Prompt: Professional Car-Rental Website Recovery" and the "Skill-Orchestrated Frontend Recovery Protocol"; goals: calm, fast, accessible, honest, anti-AI-slop; remove cinematic effects; measure everything; log skills honestly; route-by-route small commits; completion gates; keep docs in sync):

1. **Performance and hydration:** native scroll, static hero photo, removed Lenis and GSAP and the 2.5D hero; time-zone hydration mismatches fixed (dates filled in `useEffect`, tests in two time zones); city row became a grid; header overflow fixed at 320 and 768 px.
2. **P1 trust and content:** honest Contact (chat only), marketplace About, city and rating on cards, chat launcher no longer covers price, plain page titles, per-branch price filter and sort in branch currency.
3. **Accessibility pass:** dialog focus trap (`src/lib/focus-trap.ts`), named landmarks, live regions, 44 px touch targets, admin selects named and contrast raised.
4. **Gap audit** of the recovery prompt: a read-only multi-agent audit (12 of 14 units) with skeptic checks of every P0/P1. Output: `findings-register.md`, `design-gate-reviews.md`. Then fixes: search filter injection and out-of-range page crash, staff permissions on legacy admin routes (`requireAdmin(permission)`), currency and pick-up place on the booking path, auth screens (reset dead end, false success, register errors, `?next=` return path with `src/lib/safe-next.ts`), rewritten Terms and Privacy, translated page titles, localized 404 (`[...rest]` catch-all), cookie bar, chat panel height, header current-page markers, motion tokens, security migration `0018`, dead-code removal, delivery config (`.env.example`, `.nvmrc`, CI hardening, robots, sitemap).
5. **Performance passes:** removed Arabic and Bengali font preloads (found: every page shipped 270 KB of unused fonts); Zod JIT off in the browser (CSP `eval` report); lazy mobile menu, chat, analytics, per-language calendar data; **removed the Noto Sans SC and JP web fonts** (about 65 KB gzipped of render-blocking CSS on every page; Chinese and Japanese now use system CJK fonts); merged three copies of header controls into one; fewer database round trips; function region pinned to Tokyo. Details and numbers: `docs/audits/performance-log.md`.
6. **Interaction touches (CSS only):** favourite heart pop, booking total fade.
7. **Checkout and forms:** hold timer announced sparingly, processing state, trip details in summary, "payment is next" note, arrow keys on radio choices (`src/lib/radio-keys.ts`), admin loading rows, honest API docs.
8. **Tests added:** routes/404/robots/signed-out redirects, auth screens, booking panel with mocked APIs (no database writes), heart, dialogs and focus, accessibility tree; CI made DB-less-safe via `e2e/support.ts` (`hasSampleData`).
9. **The Fool (release pre-mortem + red team):** `docs/audits/the-fool-release-review.md`. It found the red CI (fixed), a weak staff test password (owner action), the then-unapplied 0018 (now applied), and seeded data honesty (owner decision).
10. **Token review:** impeccable `detect.mjs` over `src` now reports nothing (three font sizes onto the ramp, email template aligned, unused tokens removed).
11. **Host portal translation (staged):** stage 1 (language detection for `/provider` in the proxy, translation provider, menu, shell, overview), stages 2-3 (bookings, fleet, payouts) in 11 languages.

## 5. Architecture you need to know

- **Routes:** public site under `src/app/[lang]/(site)/` (home, cars, `cars/[slug]`, checkout, booking-confirmation, account, provider/apply, about, contact, login, register, forgot/reset password, terms, privacy, `[...rest]` 404). Admin console `src/app/(private)/admin/`. Host portal `src/app/(private)/provider/(portal)/` (no language in the URL: the proxy negotiates the language and sets header `x-bc-portal-lang`; read it with `getPortalLocale()` / `getPortalT()` in `src/lib/i18n/portal.ts`; `(private)/layout.tsx` uses it for `<html lang dir>`; the admin console has no header so stays English). API under `src/app/api/` (95 route handlers, each wrapped in `withErrorHandling`, Zod schemas in `src/lib/schemas.ts`).
- **Data access:** all privileged reads and writes go through `src/lib/queries.ts` (`server-only`, service-role client `supabase-server.ts`); browser client is `supabase.ts`. Pagination goes through `fetchPage` and search through `ilikeContains` in `src/lib/postgrest.ts`. Money is integer minor units (`src/lib/pricing/money.ts`); bookings store `total_amount` in major units of `currency` (`formatBookingTotal`).
- **Per-branch pricing:** `choosePlace` / `getVehiclePlace` (`src/lib/vehicle-place.ts`); price filter and sort only work once a place is chosen (`price-scope.ts`); the booking panel quotes from the chosen branch.
- **Availability** is enforced in Postgres (each physical car is a `fleet_units` row; reservations are time ranges with an exclusion constraint). Booking status is set only by the server.
- **Auth:** Supabase Auth. Staff need `app_metadata.role = "admin"` (service-role only) plus a `platform_staff` role; `requireStaff(permission)` in `src/lib/admin/staff.ts`, permission matrix in `src/lib/admin/permissions.ts`. MFA is opt-in (`ADMIN_REQUIRE_MFA=true`). Sign-up is pre-confirmed unless `AUTH_REQUIRE_EMAIL_VERIFICATION=true` (documented decision).
- **i18n:** `useT()` in client components inside `I18nProvider`; `getT()` in `[lang]` server components (root param); `useMaybeT()` where a component may render without a language (admin frame). Plural strings need every plural category for the language (a test enforces parity and placeholders). New user-visible strings go into all 11 files.
- **Design system** (from the local `DESIGN.md`): "Night Drive, calm edition". Asphalt near-black plus one accent, headlight gold (`oklch(0.78 0.15 80)`; bare gold text on light uses `--gold-text`); dark default, light supported; Sora headings, Inter body, Arabic and Bengali web fonts in `src/lib/fonts/`, CJK via system fonts (`globals.css`); dials variance 5, motion 2, density 4; radius base 0.85rem; status colours are text-on-tint pairs; **motion tokens** `--motion-fast` 150 ms, `--motion-medium` 220 ms, `--motion-slow` 450 ms, `--ease-standard`; no backdrop blur anywhere; city row is a grid (`data-testid="city-grid"`); one accent rule (gold on a small minority of any screen).
- **Loading conventions:** keep the first load small (about 260 KB gzipped on home). Lazy: mobile menu (`mobile-menu.tsx`), chat (`lazy-chat.tsx`, idle or on request), Analytics (after consent), calendar and its per-language data. Do not declare web fonts for every script (next/font puts all declared fonts' `@font-face` in every page's blocking CSS).

## 6. Commands and tooling

```
npm run dev                          # http://localhost:3000
npx tsc --noEmit ; npx eslint . ; npx vitest run
npx next build ; npx next start -p 3100
npx playwright test                  # webServer starts next start on port 3210 (E2E_PORT)
npm run test:db                      # needs a scratch local Postgres 16 (TEST_DATABASE_URL); the runner DROPS schema public
# CI-like browser run (no database): set NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321,
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=ci-placeholder, SUPABASE_SERVICE_ROLE_KEY=ci-placeholder, CI=true, then build and test
node scripts/perf/scroll-frames.cjs en            # path WITHOUT a leading slash (Git Bash rewrites it)
node scripts/perf/responsive-matrix.cjs http://localhost:3100
node scripts/perf/touch-targets.cjs http://localhost:3100 [--admin]
node scripts/perf/csp-violations.cjs http://localhost:3100 en/cars/honda-civic
node scripts/perf/bundle-composition.cjs          # after: npx next experimental-analyze -o
ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/perf/admin-audit.cjs http://localhost:3100   # env vars only
node C:/Users/<you>/.claude/skills/impeccable/scripts/detect.mjs src   # design-token drift detector (currently clean)
```

Lighthouse recipe: `CHROME_PATH=<playwright chromium> npx lighthouse@12 <url> --output=json ...` (add `--preset=desktop`; default mobile uses simulated throttling; `--throttling-method=devtools` is the harsher "applied" mode). Run one at a time; runs compete for CPU.

**Windows and Git Bash gotchas (they cost real time):**
- Stop servers with PowerShell (`Get-NetTCPConnection -LocalPort 3100 | Stop-Process`) before rebuilding; a stale `next start` serves old CSS and gives misleading results. No `pkill` in Git Bash.
- Git Bash rewrites arguments that start with `/` into Windows paths; pass URL paths without the leading slash.
- Writing scripts through shell heredocs with backslashes, backticks, `$$` or quotes repeatedly corrupted content. **Write script files with the file-writing tool**, then run them. Never run `sed s/\\`/`/` style edits on docs (one did and prefixed every line with a backtick).
- The file editor may halve backslashes in tool input; build backslashes with `String.fromCharCode(92)` in tests.
- Working files are LF; git converts to CRLF on commit (warnings are normal).
- `.env.local` starts with a BOM; strip it when parsing.

## 7. Lessons learned (do not repeat)

1. **CI was red for a dozen runs unnoticed** because local runs had a real database and CI does not. Fix: shared `hasSampleData` skip in `e2e/support.ts`. Always reproduce CI conditions and check the Actions API after pushing.
2. **Workflow tool resume is a prefix cache.** Resuming a worker-pool workflow re-ran finished agents and wasted budget. Resume by passing the list of pending units (`args.only`), not `resumeFromRunId`. Avoid launching many agents at once: the account session limit killed runs twice.
3. **Measure before claiming.** "Two font preloads" was claimed and was wrong (four, including 270 KB of Arabic and Bengali). Check the HTML, not the source.
4. next/font, SWC and Zod have hidden costs: font CSS is global to the route; Zod 4 JIT calls `new Function` (CSP report).
5. A fixed-position element still causes layout shift when its height changes (cookie card on font swap).
6. Lighthouse "simulated" mobile scores model a slow phone; an unthrottled trace of the same page paints in about 160 ms. Report both honestly.
7. Do not describe a pre-confirmed sign-up or simulated payments as production-grade.

## 8. What is left (prioritised)

**Owner actions (I cannot do these):**
1. Rotate the secondary test admin password (it is short and was shared in a chat), and enable `ADMIN_REQUIRE_MFA=true` once staff are enrolled; prefer a separate Supabase project for testing.
2. Look at the signed-in host portal once in **Arabic (right-to-left)** and **German (long words)** and report layout problems. Nobody on the AI side has ever viewed the signed-in portal (no host test account exists). Consider creating one (a host account on the demo data) so it can be tested.
3. Decide launch settings: `AUTH_REQUIRE_EMAIL_VERIFICATION`, `CONSENT_SALT`, `CRON_SECRET`, `QUOTE_SIGNING_SECRET`, real support contact when it exists.
4. Run a **real screen-reader session** (NVDA + Firefox, VoiceOver + Safari) on home, cars, vehicle booking, checkout, login. Not done by any tool.
5. Have a native reader per language skim auth, booking and portal strings. About 300 strings were written by an AI and are unreviewed.

**Portal translation, remaining stages** (all portal UI is under `src/components/provider/*` and `src/app/(private)/provider/(portal)/*`; pattern: add keys under `portal.<screen>.*` to all 11 files, use `useT()`/`getPortalT()`, use `formatMinor(..., numberingLocale(locale))`, logical CSS `ms/me/text-end` instead of left/right; add dynamic keys to `src/lib/portal-messages.test.ts`):
- Stage 4: calendar/availability (`calendar-view.tsx`), pricing (`pricing-manager.tsx`, 415 lines), reviews (`reviews-manager.tsx`).
- Stage 5: disputes (`disputes-manager.tsx`), team (`team-manager.tsx`), settings (`settings-panel.tsx`), onboarding and the application form (`onboarding-panel.tsx`, `apply-form.tsx`, `attestation-card.tsx`), and the document status words shown next to uploads.
- Server-side API error messages are English everywhere; translating them is a separate task.
- The Terms and Privacy pages are English-only by design (a notice says so in other languages).

**Performance (target mobile 95 not met; expect 85-92 realistically):** remaining weight is React and Next runtime (about 155 KB gz) plus Base UI positioning and menu code needed above the fold. Ideas: render more of the home page without client components; lazy-hydrate the search bar's time selects; replace the three Base UI Selects in the search bar with native selects on touch; verify with `bundle-composition.cjs` and Lighthouse. Cold-start latency and the seeded database round trips also matter. Re-measure Lighthouse after the Tokyo region pin (only response times were re-measured).

**Open audit findings (25, all P2)** in `docs/audits/findings-register.md`: landscape header height (A4/B8), test gaps (filter outcomes TG-06, flake risks TG-08, weak assertions TG-09, soft 404 for unknown vehicle TG-10/F9, tests that skip without a database TG-03), lead scoring trusts client name/email (SEC-API-2), account enumeration on sign-up (SEC-API-8), unsigned n8n webhooks (SEC-PRIV-007), cookie `Secure` flags and consent salt (SEC-COOKIE-009), preview deployments could use production keys (DEVOPS-3), dependency freshness (DEVOPS-10), one action verb pair "Rent Now"/"Book Now" (VAC-7), About page weight and label (VAC-8/9), empty-state alignment (F7), cancel message disappears on refresh (F10), unused CSS tokens (DC-05), library functions used only by tests (DC-08), duplicated reveal observer in how-it-works (DC-10), swallowed secondary fetch errors (F6), only one `loading.tsx` (F5 partly done for admin lists).

**Other unfinished items:** host-editable vehicle description field (S13); Code Reviewer and Architecture Designer skills never run on the shared systems; a second Fool pass in "Test the evidence" mode on the About and Contact claims; a host test account and signed-in portal e2e tests (skip when absent); e2e for checkout and confirmation pages (need a seeded booking or mocks); Stitch `DESIGN.md` export (conditional, not needed); real Supabase preview/staging project; `docs/API.md` documents only 19 of 95 routes.

## 9. Known risks (from The Fool)

Weak staff test password on the live database (owner action above); seeded data presented as real (owner decision); "fast" is a range (mobile 78-91, cold 1.8-2.3 s before region pin); accessibility claims rest on automated checks plus keyboard sweeps, not a screen reader; translations unreviewed; guests can hold cars for 15 minutes without an account (limit is 5 bookings a minute per address; a script with rotating addresses could hold a small fleet; per-car or per-email hold caps would fix it); the AI chat has 10 requests a minute per address and token/time caps but no global daily budget; small chance a free-tier database pauses when idle (hypothesis, plan unknown).

## 10. Where things are documented

| File | What it holds |
|---|---|
| `README.md` | Public overview, setup, env variables, scripts, structure |
| `docs/DECISIONS.md` | Why non-obvious choices were made (newest first) |
| `docs/GO-LIVE.md` | Migration order and check queries, launch checklist (0018 marked applied) |
| `docs/API.md` | Original route reference (19 of 95 routes; says so) |
| `docs/PROVIDER-PORTAL.md`, `docs/AI-AND-AUTOMATION.md`, `docs/compliance/*` | Host portal, AI chat and n8n, GDPR/PCI/retention records |
| `docs/audits/findings-register.md` | All 110 audit findings with severity, second check and status |
| `docs/audits/performance-log.md` | Every Lighthouse, trace and response-time measurement, with causes |
| `docs/audits/the-fool-release-review.md` | Pre-mortem and red team of the release |
| `docs/audits/design-gate-reviews.md` | The four design review blocks (Impeccable, Taste, High-End, Industrial) |
| `docs/audits/skill-orchestration-log.md` | Which skills were actually invoked, which were not, and why |
| `docs/audits/skill-availability-report.md` | Installed skills and paths (epic-design was unavailable) |
| `docs/audits/accessibility-checklist.md`, `responsive-matrix.md`, `motion-inventory.md`, `ai-slop-register.md`, `frontend-baseline.md` | Evidence for each area |
| `migrations/*.sql`, `tests/sql/*.test.sql` | Schema history and SQL tests |
| `e2e/*.spec.ts`, `scripts/perf/*` | Browser tests and measurement probes |

## 11. How to continue in a new session

1. Read this file, then `git log --oneline -15`, then `docs/audits/findings-register.md` (open items) and the tail of `docs/audits/skill-orchestration-log.md`.
2. Confirm CI is green (`api.github.com/repos/mehenuf/car-rental-project/actions/runs?per_page=3`) and `npx tsc --noEmit && npx eslint . && npx vitest run` pass before changing anything.
3. Ask the owner what to take next; the default is portal stage 4, then stage 5, then the performance ideas in section 8.
4. After every batch: run the checks, measure if performance was touched, update `docs/audits/*` and this file, commit as the owner without attribution, push, and check CI.
