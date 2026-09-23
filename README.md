# BestCar

A car rental marketplace. Local rental companies and private owners list cars, renters book them in their own language and currency, and BestCar handles pricing, payment records, payouts, reviews and disputes.

**Live:** https://car-rental-project-mehenuf.vercel.app

> Payments on the live site are **simulated**. No real money moves. Real Stripe, email and SMS have never been run against this code; see [Known limits](#known-limits).

## What it does

**Renters**
- Search by place, dates and time. A location picker with search-as-you-type covers every branch and country.
- See one total in local currency, with fees, taxes, extras and the deposit in the quote. A quote is signed and valid for 15 minutes.
- Book without an account, or register to keep trips, receipts, driver licence details and notification settings.
- Get email, SMS or web-push updates, message the host, review the trip, and open a dispute.
- Download or delete their own data.

**Hosts (rental companies and private owners)**
- Register as either type, then use a partner portal for fleet, branches, pricing, calendar, team roles, bookings, handover photos, payouts, reviews and disputes.

**Staff**
- Admin console with staff roles, an audit log, four-eyes approvals, reports per currency and licence review.

**Everyone**
- 11 languages including right-to-left Arabic, cookie consent, and a chat assistant grounded in the live catalogue that also scores leads for the n8n automation.

## Tech stack

- Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS v4, shadcn/ui on Base UI
- Supabase: Postgres with row-level security, Auth, Storage
- Zod v4 for validation, Stripe (test mode) for cards, Resend and Twilio behind interfaces (log-only by default), Web Push
- Native scrolling and CSS transitions only (no animation library)
- Vitest, Playwright with axe, a SQL test runner on PostgreSQL 16
- Deployed on Vercel with a daily cron job

## Quickstart

Requires Node 22, a Supabase project and (for the SQL tests) a local PostgreSQL 16.

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

Create the database by running `schema.sql`, then every file in `migrations/` in order (`0001` to `0018`) in the Supabase SQL editor. **Never run `schema.sql` against a database that holds real data: it drops tables.** Optional sample data:

```bash
npx tsx seed.ts                # WIPES vehicles and bookings, then adds 24 cars and about 200 bookings
# or, on an existing database, add reviews, disputes, messages and two more providers without deleting anything:
# run scripts/demo-data.sql in the Supabase SQL editor (see docs/GO-LIVE.md, step 3b)
npx tsx promote-admin.ts you@example.com   # grant staff access to an existing account
```

## Environment variables

Set these in `.env.local` locally and in Vercel for production.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | The Supabase project URL. Used by both the browser client and the server. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase's public anon key. Safe to expose to the browser; row-level security limits what it can actually do. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase's service-role key. This one is server-only. It bypasses row-level security, so it is used for admin writes, booking creation, and lead scoring. |
| `GROQ_API_KEY` | API key for Groq, the primary AI provider behind the chat assistant. |
| `GEMINI_API_KEY` | API key for Gemini, the automatic fallback if a Groq request fails. |
| `AUTH_REQUIRE_EMAIL_VERIFICATION` | Optional. Off by default: new accounts can sign in immediately. Set to `true` to require the emailed confirmation link (needs SMTP configured in Supabase). |
| `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_WEBHOOK_SECRET` | Optional. Send email through Resend (without them, messages are written to the console and the `notifications` table). The webhook secret verifies delivery, bounce and complaint callbacks. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_VERIFY_SERVICE_SID` | Optional. Text messages and phone verification through Twilio. Without the Verify service the demo accepts code 000000. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Optional. Web Push (free): generate with `npx web-push generate-vapid-keys`. |
| `NEXT_PUBLIC_SITE_URL` | The public origin, used for links inside emails and to verify Twilio webhooks. |
| `ADMIN_REQUIRE_MFA` | Optional. Set to `true` to require staff to use an authenticator app (second factor) for the admin console. Off by default. |
| `CONSENT_SALT` | Secret salt used to hash IPs stored with cookie-consent records. Set a long random value in production. |
| `SENTRY_DSN` | Optional. When set, server errors are sent to Sentry (personal data scrubbed) as well as logged as JSON. |
| `QUOTE_SIGNING_SECRET` | Server-only secret (at least 32 characters) used to sign the 15 minute price quotes returned by `POST /api/quote`. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. If it is missing or shorter than 32 characters, a key is derived from `SUPABASE_SERVICE_ROLE_KEY` instead; set it in production so it can be rotated independently. |
| `CRON_SECRET` | Server-only secret that protects `GET /api/cron/maintenance`. Vercel Cron sends it as `Authorization: Bearer <secret>`. Without it the endpoint answers 503. |
| `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | Optional. Stripe **test-mode** keys and the webhook signing secret. With them, card payments go through Stripe. Without them every method is simulated and the site works the same. |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Run, build, serve |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |
| `npm run test:coverage` | Unit tests with the coverage gate (85% on the pure-logic libraries) |
| `npm run test:db` | SQL tests. Needs `TEST_DATABASE_URL` pointing at a scratch local PostgreSQL; the runner drops the `public` schema |
| `npx next typegen` | Generate route types (`PageProps`, `LayoutProps`); needed before `tsc` on a fresh checkout |
| `npx playwright test` | Browser tests (95): smoke, security headers, language switch, location picker, landing page, routes and 404, sign-in and recovery screens, dialogs and focus, accessibility and the accessibility tree |

## Project structure

```
src/app/[lang]/(site)/   public site, account and provider-application pages (per language)
src/app/(private)/       admin console (English) and provider portal (11 languages, language negotiated by the proxy)
src/app/api/             route handlers (docs/API.md documents the core public and admin routes only, 19 of 95; the rest follow the folder names)
src/components/          site, ui (shadcn), admin, provider, location
src/lib/                 pure logic and services: pricing, payments, comms, account, admin, disputes, reviews,
                         location, seo, security, i18n
src/messages/            translations, one JSON file per language (status.json records review state)
migrations/              numbered SQL migrations 0001 to 0018 (expand-only)
tests/sql/               SQL tests, run by scripts/run-sql-tests.ts
e2e/                     Playwright specs
scripts/                 SQL test runner and demo-data.sql
docs/                    guides, API, compliance, plans
```

## Deployment

Vercel builds from `main`. The database migrations must be applied first: follow [docs/GO-LIVE.md](docs/GO-LIVE.md). CI (`.github/workflows/ci.yml`) runs type generation, type check, lint, unit tests with coverage, SQL tests on a PostgreSQL service, the build and the browser tests.

## Documentation

| | |
|---|---|
| [docs/GO-LIVE.md](docs/GO-LIVE.md) | Step-by-step upgrade of the live site |
| [docs/API.md](docs/API.md) | Route reference |
| [docs/PROVIDER-PORTAL.md](docs/PROVIDER-PORTAL.md) | Host portal and roles |
| [docs/AI-AND-AUTOMATION.md](docs/AI-AND-AUTOMATION.md) | Chat assistant and the n8n lead workflow |
| [docs/compliance/](docs/compliance/) | Privacy matrix, processing record, sub-processors, breach runbook, go-live legal checklist |
| [docs/audits/](docs/audits/) | Frontend baseline, performance log, motion inventory, responsive matrix, AI-slop register, findings register (110 audit findings and their status), design gate reviews, accessibility checklist, skill log |
| [docs/superpowers/](docs/superpowers/) | Design specs and implementation plans per sub-project |

## Known limits

- Payments are simulated. Stripe test mode works with keys; live payments, Stripe Connect payouts and tax review are not done.
- Email, SMS and web push have not been run against real providers.
- Ten of the eleven languages are machine-drafted and have not been read by native speakers. Privacy and terms pages are English only.
- Scripts are allowed inline (`'unsafe-inline'`) in the Content Security Policy, so every page can stay statically generated. Everything else in the policy is strict. See docs/DECISIONS.md.
- Nothing here has had legal or security review by a third party.

## Contributing

Work on a branch, keep changes small, and run `npx next typegen && npx tsc --noEmit && npm run lint && npm test` before pushing. New user-facing text goes into every file in `src/messages` (a test fails if a language is missing a key). Database changes are a new numbered migration plus a SQL test.

## License

All rights reserved. See [LICENSE](LICENSE). The code is shared for review, not for reuse or redistribution.
