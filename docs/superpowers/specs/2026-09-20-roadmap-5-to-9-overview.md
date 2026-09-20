# Sub-projects 5 to 9 — Overview and Shared Decisions

Date: 2026-09-20
Status: Draft for one combined review
Parent: `2026-09-19-marketplace-platform-design.md` (roadmap items 5 to 9).
Builds on: sub-projects 1 to 4 (booking engine, pricing, payments and ledger, provider portal), on branch `feature/marketplace-core`.

This overview holds the decisions that cut across the five specs. Each spec below is self-contained and lists its own decisions, data model, structure and tests:

| Spec | File | Migration |
|---|---|---|
| 9a. Internationalisation foundation (built first) | `2026-09-20-hardening-compliance-localisation-design.md`, part A | none |
| 5. Customer account and trust | `2026-09-20-customer-account-trust-design.md` | `0012` |
| 6. Communications | `2026-09-20-communications-design.md` | `0013` |
| 7. Reviews, disputes and trust and safety | `2026-09-20-reviews-disputes-safety-design.md` | `0014` |
| 8. Platform admin and operations | `2026-09-20-platform-admin-operations-design.md` | `0015` |
| 9b. Compliance, security, quality, SEO, translations | same file as 9a, part B | `0016` |

## 1. Build order, and why it differs from the roadmap

**9a, then 5, 6, 7, 8, then 9b.** The internationalisation foundation moves every public page under a `[lang]` route segment (the structure the Next.js 16 docs describe) and introduces the message layer. Doing it before sub-projects 5 to 7 means their new screens and email templates are written with message keys from the first line instead of being retrofitted. Translations, SEO metadata per language, compliance and hardening come last (9b) because they need the finished screens.

## 2. Email and SMS providers (chosen by me, as you asked)

**Email: Resend.** API-first and built for transactional mail; React-based templates that fit this stack; DKIM, SPF and DMARC support with a verified sending domain; webhooks for delivered, bounced and complained (feeds a suppression list); an SMTP endpoint that can also serve as Supabase Auth's custom SMTP, which fixes the root cause the signup route works around today (unreliable shared mailer); EU sending region available; generous free tier. Considered: Postmark (best-in-class deliverability, pricier and strict), Amazon SES (cheapest, most setup work).

**SMS: Twilio.** The widest and best-documented coverage of every country this platform serves (US, UK, UAE, Canada, Australia, Netherlands, Germany, France, Nigeria, Kenya, Indonesia, Brazil, India, Bangladesh, Japan); Messaging Services with per-country sender pools; delivery receipts; automatic STOP handling; Verify for phone checks. It has real regulatory friction (US A2P 10DLC registration, India DLT, sender-ID rules in Bangladesh, Nigeria, Kenya and Indonesia), so SMS is limited to a few critical messages, and the specs list the registration work as a go-live task, not a code task. Considered: Vonage and Bird (comparable, weaker docs), local aggregators (cheaper per country, many contracts).

**Both sit behind provider interfaces with a `log` implementation as the default**, exactly like payments: with no keys the demo still works and shows what would have been sent, and either vendor can be swapped without touching callers.

## 3. Languages and countries

Interpreting "all the current countries plus English, Bengali, Spanish, French, Arabic, Portuguese, Mandarin and Japanese":

- **Languages (11):** `en`, `bn`, `es`, `fr`, `ar`, `pt`, `zh` (Simplified Chinese), `ja`, and, for the Netherlands, Germany and Indonesia, `nl` (Dutch), `de` (German) and `id` (Indonesian). Arabic is right-to-left; the other ten are left-to-right. Dutch, German and Indonesian use the Latin alphabet, so they need no extra fonts.
- **Countries:** every country the platform already serves: US, GB, AE, CA, AU, NL, DE, FR, NG, KE, ID, BR, IN, BD, JP. Each gets a default language, currency and time zone. Each country's default language is now covered except India (Hindi) and Kenya (Swahili), which fall back to English and can gain a language later by adding one translation file. Nigeria, Kenya, India, the UAE, Canada, Australia, the United States and the United Kingdom all use English by default (Arabic and French are offered where relevant).
- **Traditional Chinese, and further Arabic variants,** are not included. The default Arabic uses Western digits.

## 4. Decisions to confirm (the ones that affect several specs)

1. The build order above, with 9a first.
2. Resend for email and Twilio for SMS, behind interfaces with a `log` default.
3. The language and country interpretation in section 3.
4. **Real account emails.** Sub-project 5 turns on genuine email verification and password reset through Supabase Auth using Resend's SMTP, and removes the pre-confirmed-account workaround in `/api/auth/signup`. This needs the sending domain verified by you (DNS records) and the SMTP settings entered in the Supabase dashboard.
5. **Scheduled work stays cron-light.** Vercel's Hobby plan allows only daily crons. Emails and SMS are sent right after the request that caused them (Next.js `after()`), and a single dispatcher cron retries failures and sends reminders, so correctness never depends on cron frequency.
6. **Money stays per currency.** Reports never add different currencies together; a manually maintained FX-rate table exists only for reporting comparisons and is labelled as such.
7. **Demo scope is preserved.** Payments, payouts, KYC, licence checks and tax remain simulated or manual, but designed so real processors and checks can replace them.

## 5. Things I cannot do for you (needed at go-live)

Verify the sending domain and enter SMTP settings in Supabase; create Resend and Twilio accounts and keys; complete SMS sender registrations per country; and take legal advice on the privacy policy, terms and retention periods before real customers use the site. The specs make each of these an explicit checklist item.
