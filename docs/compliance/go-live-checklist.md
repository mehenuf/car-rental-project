# Go-live legal and operations checklist

- [ ] Counsel reviews privacy policy, terms, cookie text for each launch country; legal pages translated by qualified translators
- [ ] Native-speaker review of every language (update `src/messages/status.json` to `human-reviewed`)
- [ ] Data-processing agreements signed (see sub-processors.md)
- [ ] Set `CONSENT_SALT`, `QUOTE_SIGNING_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`, `SENTRY_DSN`, Stripe, Resend, Twilio, VAPID keys
- [ ] Apply migrations to the real Supabase project; run the SQL tests against a scratch copy first
- [ ] Turn on real Stripe with webhooks; verify refunds, deposits and payouts end to end with test cards
- [ ] Insurance and licence-check policy confirmed by counsel and insurer
- [ ] Regulator registrations (see country-matrix.md); name DPO / privacy officer
- [ ] Staff accounts created with second factor enforced (set `ADMIN_REQUIRE_MFA=true` once staff have enrolled)
- [ ] Backups and restore test; uptime monitor on `/api/health`
- [ ] Penetration test or security review by a third party
