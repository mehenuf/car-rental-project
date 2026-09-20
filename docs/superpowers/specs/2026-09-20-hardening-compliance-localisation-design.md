# Hardening, Compliance and Localisation — Design Spec (sub-project 9, in two parts)

Date: 2026-09-20
Status: Draft for one combined review (see `2026-09-20-roadmap-5-to-9-overview.md` for shared decisions)
Migration: none for part A; `0016` for part B.

**Part A (9a) is built first**, before sub-project 5, because it restructures routes. **Part B (9b) is built last**, because compliance, security checks, accessibility audits, SEO and translations need the finished screens.

---

# Part A: Internationalisation foundation (9a)

## A1. Scope

**In:** locale-prefixed public routes, locale negotiation, a message layer with plurals and interpolation, locale-aware formatting, right-to-left support for Arabic, per-language fonts, a language switcher, translated catalogue content storage, and a translation workflow with parity checks. English is the complete source; the other ten languages get machine-drafted files flagged unreviewed until a native speaker signs them off.

**Out:** translating provider-entered free text (names, descriptions a provider types stay in the language they were written in); Traditional Chinese; languages beyond the eleven (hi, sw and others fall back to English and can be added later by adding one file); translating the platform admin (English only).

**Languages (11):** `en`, `bn`, `es`, `fr`, `ar` (right-to-left), `pt`, `zh` (Simplified), `ja`, `nl`, `de`, `id`. **Countries:** every country already served (US, GB, AE, CA, AU, NL, DE, FR, NG, KE, ID, BR, IN, BD, JP), each with a default language, currency and time zone in `src/lib/provider/countries.ts`.

## A2. Decisions to confirm

1. **Always-prefixed URLs.** Public pages live at `/{lang}/...` (`/en/cars`, `/ar/cars`). A `proxy.ts` step negotiates the locale from a saved preference, then `Accept-Language`, then the visitor's country header, and redirects `/` and unprefixed public paths. This is the structure the Next.js 16 internationalisation guide describes (a `[lang]` segment). It gives clean SEO (`hreflang`) and shareable language-specific links.
2. **A small in-house message layer**, following the pattern in the Next.js docs (JSON dictionaries loaded per request on the server, a `t(key, params)` helper, plural rules from `Intl.PluralRules`, keys typed from `en.json`), rather than adding a library whose Next.js 16 compatibility I cannot verify. If a mature library proves compatible during build, swapping is contained to one module.
3. **Private areas use a cookie, not a URL prefix.** `/account`, `/provider` and `/checkout` are not indexed, so their language comes from the saved preference cookie. The platform admin stays English.
4. **Logical CSS everywhere.** Physical utilities (`ml-`, `pl-`, `text-left`, `left-`) are replaced by logical ones (`ms-`, `ps-`, `text-start`, `start-`) so Arabic mirrors correctly. A check script fails the build on new physical utilities in translated areas. Directional icons are mirrored explicitly.
5. **Fonts per script**, loaded only for the active language with `next/font` subsets: Noto Sans for Latin (English, Spanish, French, Portuguese, Dutch, German, Indonesian), plus Noto Sans Arabic, Bengali, SC and JP.
6. **Western digits for Arabic** by default (`ar-u-nu-latn`), configurable later.
7. **Catalogue text is translated in the database** (`vehicle_translations`, part B migration), with fallback to English. Provider free text is not translated.

## A3. Structure

- `src/messages/{lang}.json` (nested by feature, English complete), plus `src/lib/i18n/` with `locales.ts` (supported list, default, direction, country defaults), `negotiate.ts` (pure: header + cookie + country to locale), `dictionary.ts` (server loader), `t.ts` (interpolation and plurals), `format.ts` (currency, date, number, list, relative time with a locale argument), and `link.tsx` (prefixing helper).
- `src/app/[lang]/(site)/...` replaces `src/app/(site)/...`; a `[lang]/layout.tsx` sets `lang` and `dir`, loads the font, and provides messages to client components for the namespaces they use.
- Existing helpers `formatCurrency`, `formatDate` and `formatMinor` gain a locale parameter (default `en`) so callers migrate gradually.
- Language switcher in the header and footer; choosing a language sets the cookie and navigates to the same page in that language.
- Pseudo-locale `en-XA` (accented, 40% longer strings) enabled in development to expose layout problems before translators do. German and Dutch compound words are the real-world test of that: buttons and table headers must wrap or truncate cleanly.

## A4. Testing

Pure tests for negotiation (header, cookie, country precedence), plural rules per language (Arabic has six forms, Japanese and Chinese one), interpolation, and locale formatting. A parity test compares every locale's keys to `en.json` (fails on missing or extra keys, reports untranslated values). Playwright smoke tests (part B) load key pages in every language and in RTL.

---

# Part B: Compliance, security, quality, SEO and translations (9b)

## B1. Scope

**In:** consent management and policy versioning, data-subject requests (export and erasure), retention, a country compliance matrix and the documents behind it; security headers, durable rate limiting, CSRF checks, MFA, error monitoring, health checks; CI with end-to-end, accessibility and performance gates; caching and query performance; SEO; the translation review process and legal-page handling.

**Out:** legal advice, real KYC vendors, penetration testing by a third party (recommended before going live, listed as a task), certifications such as SOC 2 or ISO 27001.

## B2. Decisions to confirm

1. **Consent gates analytics.** The cookie banner has "necessary" (always on) and "analytics" (off until granted). Vercel Analytics loads only after consent. Every choice is logged with the policy version.
2. **Erasure anonymises, it does not delete financial history.** A verified erasure request removes or tombstones personal data (name, email, phone, licence data, messages, review text) but keeps booking, payment and ledger rows, which carry no personal data once anonymised, for the legally required retention period. The immutable ledger is untouched because it holds no personal data.
3. **Durable rate limiting in Postgres**, using an atomic function (`rate_limit_hit(key, window, limit)`) instead of the current in-memory limiter, so limits survive restarts and work across serverless instances, with no new vendor.
4. **Sentry for error monitoring** through `instrumentation.ts` (as the Next.js docs describe), with personal data scrubbed before sending, plus structured JSON logs carrying a request id.
5. **MFA:** required for platform staff (sub-project 8), strongly encouraged for provider owners, optional for customers, using Supabase TOTP.
6. **CI gates:** lint, type-check, unit tests, SQL tests on a Postgres service container, build, Playwright end-to-end tests against a local Supabase started in CI, axe accessibility scans on key pages in every language including Arabic, and Lighthouse budgets (LCP 2.5 s, CLS 0.1). Coverage floor of 85% on the pure logic libraries.
7. **Machine-drafted translations ship flagged.** Each non-English file carries a `reviewed: false` marker shown to maintainers (never to customers) until a native speaker signs off. Legal pages (terms, privacy) are translated only after legal review; until then they show in English with a notice.
8. **Per-city landing pages** (`/{lang}/cars/in/{city}`) are generated from approved providers' branches for SEO.

## B3. Compliance

- **Data model (`0016`):** `consents(id, user_id null, anon_id null, purpose, granted, policy_version, created_at, ip_hash)`, `policy_versions(kind, version, published_at, content_hash)`, `policy_acceptances(user_id, kind, version, accepted_at)`, `data_requests(id, user_id, kind export|erase, status requested|verifying|processing|done|rejected, requested_at, completed_at, note)`, `retention_rules(entity, keep_days, action)`, `vehicle_translations(vehicle_id, lang, description, features)`, and the `rate_limits` table with `rate_limit_hit`.
- **Flows:** `/account/privacy` (download my data, delete my account, consent settings, policy versions accepted); re-acceptance prompt when a policy version changes; a 18+ check at signup and booking (date of birth from the driver profile); an erasure job that anonymises in a defined order and records what was done; a retention job that applies `retention_rules`.
- **Country matrix** in `docs/compliance/country-matrix.md`: EU and UK GDPR (Netherlands, Germany, France, United Kingdom), CCPA and CPRA (United States), LGPD (Brazil), APPI (Japan), PIPEDA (Canada), the Australian Privacy Act, India's DPDP Act, UAE PDPL, Kenya's Data Protection Act, Nigeria's NDPA, Indonesia's PDP law and Bangladesh's data protection rules. Each row maps the obligation (consent, access, deletion, breach notification, cross-border transfer, local representative or officer) to the feature that meets it or to a legal task.
- **Documents in `docs/compliance/`:** record of processing activities, sub-processor list (Supabase, Vercel, Stripe, Resend, Twilio, the AI providers, n8n), a short data protection impact assessment, a breach response runbook, a PCI SAQ-A statement (card data never touches our servers), and a go-live legal checklist. These are drafts for a lawyer, not legal advice.

## B4. Security

Content Security Policy with a per-request nonce (per the Next.js CSP guide) and the standard headers (HSTS, `frame-ancestors 'none'`, referrer policy, permissions policy); an origin check on mutating API routes; the Postgres rate limiter on every public write and on login and quote endpoints; MFA as above; secrets scanning, `npm audit` and Dependabot in CI; an expanded SQL suite that asserts a policy test for every table so a new table cannot ship without row-level security; `/api/health` (database ping, safe to expose); documented backup and restore drill; incident runbook.

## B5. Quality, performance and accessibility

Caching for the catalogue and search pages using the Next.js 16 caching APIs, revalidated by tag when vehicles or prices change; a review of query plans for search and availability (`EXPLAIN` in the SQL suite with an index assertion); pagination on every list; an audit of the provider portal APIs for repeated queries. Accessibility to WCAG 2.2 AA: focus management in dialogs, error announcement, 44 px touch targets, `prefers-reduced-motion` honoured by the existing GSAP animations, contrast checks in light and dark themes, and right-to-left checks.

## B6. SEO

`sitemap.xml` per language (catalogue, cities, static pages), `robots.txt`, canonical URLs and `hreflang` alternates, JSON-LD (Organization, and Product with Offer for vehicles), localised metadata and Open Graph images, city landing pages, and clean 404 and redirect handling for retired vehicles.

## B7. Testing and rollout

Vitest for consent logic, erasure ordering, retention rules, rate-limit function behaviour (through SQL tests), and metadata builders; SQL tests for the new tables and for `rate_limit_hit`; Playwright and axe as in decision 6. Rollout: apply `0016`, add Sentry and any new keys in Vercel, deploy to a preview first, run the e2e and accessibility gates, then production. Go-live checklist: native review of translations, legal review of policies, third-party penetration test, Resend and Twilio setup from the overview, backup drill completed.
