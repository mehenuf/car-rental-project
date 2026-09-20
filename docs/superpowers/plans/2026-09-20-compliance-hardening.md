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

## Follow-up pass (gaps closed after the first 9b commit)
- Migration `0017`, SQL test 15: retention for licence photos (730 days, skipped while a booking is open; files removed from storage by the cron before rows are deleted) and messages (1095 days, finished bookings only, never with an open dispute); policy re-acceptance (`policies_to_accept`, `accept_policies`). Retention days are starting values to confirm with counsel.
- Account area shows a notice when terms or privacy changed; `/api/account/policies`.
- Legal pages show a notice in every non-English language that the English text applies.
- Per-city pages `/{lang}/cars/in/{city}` (in the sitemap); translated vehicle description and features with English fallback per field.
- Vitest coverage gate (85% lines/functions/statements, 80% branches) on the pure-logic libraries; currently about 98%. axe accessibility tests in Playwright; they found and I fixed two real issues (unlabelled rating role, keyboard access to the testimonial scroller) and a hard-coded English label.

## Still not done
- Nothing has run against real Supabase, Stripe, Resend, Twilio or Sentry; the CI workflow has never run on GitHub.
- Human-written legal text and native-speaker review of translations; there is no admin screen to edit vehicle translations or publish new policy versions (versions are added by migration or SQL).
- Vehicle structured data has no price (per-branch currency). Caching and query-plan review. Lighthouse budgets.

## Rollout
Apply migrations 0012–0016, set env vars (README), especially `CONSENT_SALT`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`; walk through `docs/compliance/go-live-checklist.md`.
