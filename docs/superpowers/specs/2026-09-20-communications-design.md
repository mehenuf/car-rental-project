# Communications — Design Spec (sub-project 6)

Date: 2026-09-20
Status: Draft for one combined review (see `2026-09-20-roadmap-5-to-9-overview.md`)
Migration: `0013`. Built after sub-project 5 and after part A of the localisation spec (9a).
Providers: **Resend** for email, **Twilio** for SMS, each behind an interface with a `log` default (chosen and justified in the overview).

## 1. Scope

**In:** a transactional outbox so notifications are never lost or duplicated; email and SMS delivery through provider interfaces; localised templates for every customer and provider event; per-booking messaging between customer and provider; notification preferences and consent; delivery, bounce, complaint and opt-out handling; scheduled reminders.

**Out:** marketing campaigns and newsletters (no marketing sends are built; the preference model leaves room for them), WhatsApp and push notifications, in-app real-time chat (messages are asynchronous with email alerts), a support ticketing system (8 covers support tooling).

## 2. Decisions to confirm

1. **Transactional outbox.** Domain events are written to an `outbox_events` table in the same database transaction as the change that caused them (a booking is confirmed, a payment succeeds), so a crash can never lose a notification or send one for a change that rolled back. A dispatcher turns events into per-channel notifications.
2. **Send now, retry later.** The dispatcher runs immediately after the request that wrote the event, using `after()` from Next.js, so customers get email within seconds. A single cron endpoint retries failures with exponential backoff and sends reminders that are due. Because Vercel Hobby allows only daily crons, correctness does not depend on cron frequency; on a paid plan the same endpoint runs every five minutes.
3. **Idempotent by construction.** Each notification has a dedupe key (`event id + channel + recipient + template`), enforced unique, so a retried dispatcher never sends twice.
4. **Essential messages cannot be turned off; everything else can.** Verification, receipts, booking confirmation and cancellation, refunds, pickup instructions, security alerts and legal notices are essential. Reminders and messaging alerts are switchable per channel. No marketing exists yet, so nothing needs opt-in beyond SMS.
5. **SMS is rare, consented and quiet-hours aware.** SMS is used only for: booking confirmed, pickup reminder, and a security code. It requires an explicit opt-in with the phone number verified (Twilio Verify), it respects quiet hours (nothing between 21:00 and 08:00 in the recipient's local time; held until morning), and STOP replies opt the number out immediately through Twilio's webhook.
6. **Templates are code, localised by message keys.** React Email components render HTML and a plain-text alternative, taking their strings from the same message catalogue as the site (built in 9a), in all eight languages, right-to-left for Arabic. English is the fallback.
7. **Provider phone and email stay private until payment.** Messaging goes through the platform; each side sees the other's first name and messages, not contact details, until a booking is paid. Messages are moderated by simple rules (no links to off-platform payment, blocked terms) and can be reported.
8. **Suppression list.** Hard bounces, spam complaints and SMS opt-outs add the address or number to `suppressions`; the dispatcher never sends to them.

## 3. Data model (`0013`)

- `outbox_events(id, type, aggregate_type, aggregate_id, payload jsonb, locale, run_at, status pending|processed|failed, attempts, last_error, created_at, processed_at)`.
- `notifications(id, event_id, channel email|sms, template, recipient_user_id null, address, locale, status queued|sent|delivered|failed|suppressed|bounced, provider, provider_ref, error, dedupe_key unique, attempts, next_attempt_at, sent_at, delivered_at)`.
- `notification_preferences(user_id, category reminders|messages, channel, enabled)` plus `contact_channels(user_id, email_verified_at, phone_e164, phone_verified_at, sms_opt_in, sms_opt_in_at, locale, timezone)`.
- `suppressions(channel, address, reason bounce|complaint|opt_out, created_at)`.
- `message_threads(id, booking_id unique, customer_user_id, provider_id, created_at, last_message_at)` and `messages(id, thread_id, sender_side customer|provider|platform, sender_user_id, body, flagged, created_at, read_at)`.
- Functions: `enqueue_event(type, aggregate, payload, run_at)`; the existing functions that change money or status call it (`record_payment_success`, `transition_booking`, `record_refund_success`, `run_payouts`, provider review); `claim_due_notifications(limit)` using `for update skip locked`.

## 4. Event catalogue (template per event and audience)

Customer: account verification, password reset, booking received, payment receipt and booking confirmed (with the pickup address), booking modified, booking cancelled with refund details, refund issued, pickup reminder (24 hours and 2 hours, SMS optional), return reminder, new message, licence verified or rejected, deposit released, review request, dispute opened or resolved. Provider: application received, approved or rejected with reason, document rejected, car approved or rejected, new booking, booking cancelled, upcoming pickup and return, new message, payout paid, dispute opened. Platform staff: high-risk booking, new application, new dispute.

## 5. Code layout (`src/lib/comms/`)

`types.ts`; `email-provider.ts` and `sms-provider.ts` interfaces; `resend-provider.ts`, `twilio-provider.ts`, `log-provider.ts` (default, writes to the notifications table and the console); `registry.ts`; `dispatcher.ts` (claim, render, send, record, retry); `quiet-hours.ts` (pure); `templates/` (React Email per event); `webhooks` for Resend (delivery, bounce, complaint, signature-verified) and Twilio (status callbacks and STOP). Routes: `POST /api/webhooks/resend`, `POST /api/webhooks/twilio`, `GET /api/cron/dispatch`, messaging endpoints for customers (`/api/account/messages`) and providers (`/api/provider/messages`), preference and phone-verification endpoints under `/api/account/notifications`. Screens: `/{lang}/account/messages` and preferences, a messages inbox in the provider portal.

## 6. Testing and rollout

- Vitest: quiet-hours calculation across time zones and daylight saving, dedupe keys, retry backoff schedule, preference resolution (essential versus switchable), template rendering for every event in English and one right-to-left language (no missing keys, plain-text alternative present), message moderation rules, webhook signature checks.
- SQL tests: `enqueue_event` is atomic with the change (a rolled-back change leaves no event), `claim_due_notifications` never returns the same row to two claimers, dedupe uniqueness, suppression respected, messaging access rules and row-level security (a customer sees only their thread, a provider only theirs).
- Manual checklist against a staging project with Resend in test mode: full booking, cancellation and refund email set; a message exchange; a bounce and a complaint webhook; an SMS opt-in, a reminder and a STOP reply.
- Rollout: set `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` and `CRON_SECRET`; verify the sending domain (SPF, DKIM, DMARC) and complete SMS sender registrations per country before enabling real SMS in that country; deploy with the `log` provider first, then switch channels on one at a time.
