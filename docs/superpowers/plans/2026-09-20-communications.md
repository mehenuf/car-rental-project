# Communications Implementation Plan (sub-project 6)

> Compact plan. Design: `docs/superpowers/specs/2026-09-20-communications-design.md` (approved 2026-09-20, with Web Push added on 2026-09-20). Built test first in phases; each ended with `npx tsc --noEmit`, `npm run lint`, `npx vitest run` and `npm run test:db` green, then a commit.

**Branch:** `feature/marketplace-core` (builds on migrations 0001 to 0012).

## Phases delivered

- **A. Rules (pure):** `src/lib/comms/{quiet-hours,retry,preferences,moderation,signatures,render,params,settings,phone-verify}.ts`: quiet hours across time zones and DST, dedupe keys, backoff 1 min / 5 min / 30 min / 2 h / 12 h (5 attempts), essential versus switchable messages and per-channel resolution, message moderation, Svix (Resend) and Twilio signature checks, localised rendering of email, SMS and push from the message catalogue (all 11 languages, right-to-left for Arabic, HTML escaped), settings schemas.
- **B. Migration `0013`:** `outbox_events` (with a dedupe key), `notifications` (unique dedupe key, lease-based claiming), `notification_preferences`, `contact_channels` (SMS consent needs a verified phone), `suppressions`, `push_subscriptions`, `message_threads`, `messages`; `enqueue_event`, `claim_pending_events`, `claim_due_notifications` (both `for update skip locked` with a five-minute lease), `provider_recipients`, `enqueue_due_reminders`; AFTER triggers on bookings, payouts and messages that write events in the same transaction as the change; row-level security limiting threads and messages to their two parties.
- **C. Dispatcher and providers:** injected-ports dispatcher (`dispatcher.ts`) tested with fakes; Resend, Twilio and Web Push providers behind interfaces, with a `log` default when no keys are set; `dispatchSoon()` (Next.js `after()`) wired into the payment, Stripe webhook, cancellation, no-show and message routes; `GET/POST /api/cron/dispatch`; the daily maintenance cron also queues reminders and dispatches.
- **D. Screens and APIs:** webhooks `POST /api/webhooks/resend` and `/twilio` (signature-checked; bounces, complaints and STOP replies feed the suppression list); customer and provider message routes and a shared `MessageThread` component (trip page and the provider bookings list); notification settings page with per-category channel switches, phone verification (Twilio Verify, or code 000000 in demo mode), SMS consent and browser push (service worker `public/sw.js`).

## Deviations from the spec

- **No React Email dependency.** Templates are plain functions over the message catalogue that produce HTML with inline styles and a plain-text alternative. The result is the same and avoids a dependency whose Next.js 16 compatibility could not be verified.
- **Events come from database triggers, not from edits to the money functions.** The spec suggested the existing functions call `enqueue_event`; triggers on `bookings`, `payouts` and `messages` give the same atomicity without rewriting the ledger code from sub-project 3.
- **Templates cover eight events.** Booking confirmed, cancelled, refund issued, pick-up reminder, new message, new booking (provider), booking cancelled (provider) and payout paid. Account verification and password reset stay with Supabase Auth until its SMTP is pointed at Resend (its emails are not yet localised), and the licence, deposit, review, dispute and platform-staff notices arrive with sub-projects 7 and 8.
- **Return reminder and the 2-hour pick-up reminder are not built**; only one reminder is sent, when pickup is within 24 hours. The Hobby-plan daily cron sends it at most a day ahead.
- **Provider messaging is English** (the provider portal is English-only), and the provider inbox is a dialog on the bookings list rather than a separate page.
- **The `sms.security_code` template is not built**: the security code goes through Twilio Verify, which sends its own message.
- SQL tests for `0013` were written after the migration.

## Rollout runbook

1. Apply `0013`. It only adds tables, functions and triggers.
2. Deploy with no keys: everything runs on the `log` provider (see the console and the `notifications` table). Check `select template, channel, status from notifications order by created_at desc` after a test booking.
3. Resend: create the account, verify the sending domain (SPF, DKIM, DMARC), set `RESEND_API_KEY`, `RESEND_FROM` and `RESEND_WEBHOOK_SECRET`, add the webhook `https://<site>/api/webhooks/resend` for delivered, bounced and complained. Then set the same as Supabase Auth's custom SMTP.
4. Twilio (optional, per country): set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_VERIFY_SERVICE_SID`, point the messaging service's status callback and inbound URL at `/api/webhooks/twilio`, and finish sender registration for each country before enabling SMS there.
5. Web Push: generate keys once (`npx web-push generate-vapid-keys`) and set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
6. Set `NEXT_PUBLIC_SITE_URL` (used for the links in messages) and keep `CRON_SECRET`.
7. Rollback: redeploy the previous build; the triggers keep writing events that nothing consumes, which is harmless.

## Known limitations

- Nothing has run against a real Resend, Twilio or push service, or a real browser: the rules, the dispatcher (with fakes), the request shapes of each provider (with a fake `fetch`), the signature checks and the SQL are tested; the routes and screens are type-checked, linted and built.
- The dispatcher runs at the end of the request that caused an event and from the daily cron. A crash in between leaves the event for the next run (up to a day on the Hobby plan).
- Each provider team member receives provider emails (owners and managers), with no per-member preferences yet.
