# Compliance, security, quality and SEO (sub-project 9b): what was built

**Spec:** `docs/superpowers/specs/2026-09-20-hardening-compliance-localisation-design.md` (part B). Migration `0016_compliance.sql`, SQL test 14.

## Built
- Storage and functions: consents, policy versions/acceptances, data requests, retention rules, `apply_retention`, `export_user_data`, `erase_user`, durable `rate_limit_hit`, `vehicle_translations` (table only).
- Privacy tools: cookie banner (analytics off until consent), `/account/privacy` (download, cookie choice, delete account), export and erase APIs.
- Security: strict headers, CSP, CSRF origin check in `withErrorHandling`, durable rate limits, `/api/health`.
- Monitoring: `src/instrumentation.ts` + `src/lib/observability.ts` (JSON logs, personal-data scrubbing, optional Sentry envelope over HTTP, no SDK).
- Retention runs from the daily maintenance cron.
- SEO: `robots.ts`, `sitemap.ts` (all languages with alternates), canonical + hreflang on home, cars, vehicle, about, contact; JSON-LD Organization and Product.
- 18+ minimum age in the driver profile.
- Translation review states in `src/messages/status.json` (all non-English are machine-drafted).
- Quality: Playwright smoke (24 tests: CSP violations, headers, language switch, CSRF), GitHub Actions CI, Dependabot.
- Docs: `docs/compliance/*`.

## Deviations
- **CSP allows `'unsafe-inline'` scripts**; a nonce-only policy is not possible with statically rendered pages and Next's inline bootstrap. Other directives are strict; SRI is on.
- Sentry via a small HTTP sender instead of `@sentry/nextjs` (no source maps, no performance data).
- Product JSON-LD has no `Offer`: prices are per branch currency and the legacy vehicle price has no currency.

## Not done (known gaps)
- Per-city landing pages; use of `vehicle_translations` in the UI.
- Policy-version re-acceptance prompt (data model exists).
- Legal pages remain English only. Time-based purge of licence documents and messages.
- Coverage floor and axe/Lighthouse checks in CI. Caching and query-plan review.
- CI workflow has never run on GitHub; the health-check-free Playwright start assumes placeholder Supabase values.
- Nothing has run against real Supabase, Stripe, Resend, Twilio or Sentry.

## Rollout
Apply migrations 0012–0016, set env vars (README), especially `CONSENT_SALT`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`; walk through `docs/compliance/go-live-checklist.md`.
