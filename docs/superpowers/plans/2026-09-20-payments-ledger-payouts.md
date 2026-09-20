# Payments, Ledger and Payouts Implementation Plan (sub-project 3)

> Compact plan. Design: `docs/superpowers/specs/2026-09-20-payments-ledger-payouts-design.md` (approved 2026-09-20). Every task is test-first and ends with `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (and `npm run test:db` when SQL changes) green, then a commit.

**Branch:** `feature/marketplace-core` (builds on migrations 0001 to 0008).

## Refinements to the spec made while planning

1. **All ledger postings live in SQL**, not in TypeScript builders. Posting rules are then atomic with the state change and have a single source of truth; SQL tests check balance. The TypeScript side only computes refund amounts and drives providers.
2. **A deposit is an authorization, not cash.** It creates no ledger entries while held or when released. Only a capture (later, by a damage flow) posts: debit `psp_cash`, credit the provider's `provider_payable`. The `deposit_liability` account from the spec is therefore not needed.

## Tasks

1. **Pure logic** (`src/lib/payments/`): `methods.ts` (payment methods by country and currency), `refunds.ts` (`computeRefund` from the snapshot's tiers), `simulate.ts` (deterministic simulated outcomes).
2. **Migration 0009** (`migrations/0009_payments.sql`, `tests/sql/07_payments.test.sql`): widened `payment_method`, `payments`, `payment_events`, ledger tables with append-only and balance enforcement, `payouts`, booking columns, and the functions `expire_stale_holds`, `post_ledger`, `record_payment_success`, `record_refund_success`, deposit functions, `create_payout_for_booking`, `run_payouts`; `create_booking_atomic` sets a 15-minute hold; `transition_booking` stamps `completed_at` and creates the payout.
3. **Providers**: `PaymentProvider` interface, `SimulatedProvider`, `StripeProvider` (test mode, optional), registry, Stripe webhook parsing.
4. **Persistence and service**: repository over `supabaseAdmin`, orchestration (`startCheckout`, `confirmCheckout`, `cancelBooking` with refund, `releaseDueDeposits`) with injected dependencies so the logic is tested against fakes.
5. **API**: `POST /api/payments/intents`, `POST /api/payments/[id]/confirm`, `POST /api/webhooks/stripe`, `POST /api/cron/expire-holds`, `POST /api/cron/run-payouts`; booking creation redirects to checkout; quote availability sweeps expired holds.
6. **UI**: `/checkout/[reference]` (method picker, simulated form or Stripe Elements, deposit notice, hold countdown) and paid status on `/booking-confirmation`.
7. **Seed, docs, rollout**: README, `vercel.json` cron, environment variables, runbook.

## Deviations from the spec

- One scheduled endpoint, `GET /api/cron/maintenance`, replaces the two separate cron endpoints. It runs the hold sweep, deposit release and payouts together, and Vercel Hobby allows only daily crons anyway.
- Stripe handles charges and refunds only. Security-deposit holds are always simulated, even with Stripe configured (a real hold needs a saved payment method and Connect flows).
- Ledger postings are in SQL, and a deposit is an authorization, not cash (see the refinements at the top).
- Seed adds four small local-currency demo providers (Amsterdam EUR, Mumbai INR, Dhaka BDT, Nairobi KES) so iDEAL, UPI, bKash and M-Pesa appear in the checkout.

## Rollout runbook (production Supabase and Vercel)

Prerequisite: migrations `0003` to `0008` applied and their code deployed.

1. Back up production and confirm the backup exists.
2. Rehearse `0009` on a copy or a Supabase branch. Check: `select payment_status, count(*) from bookings group by 1` (legacy confirmed, active and completed bookings are `paid`, the rest `unpaid`), and that `select count(*) from bookings where hold_expires_at is not null` is 0 (legacy bookings never expire).
3. In Vercel add `CRON_SECRET` (any long random string). Optional Stripe test mode: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and `STRIPE_WEBHOOK_SECRET` from a webhook endpoint that points at `https://<your-domain>/api/webhooks/stripe` and listens to `payment_intent.succeeded` and `payment_intent.payment_failed`. Use test keys only.
4. Apply `0009`, then deploy. The previous release keeps working against the migrated database, except that bookings it creates are held for 15 minutes with no checkout page to pay them, so they will expire. Deploy immediately after migrating.
5. Smoke test with simulated methods: book a car, pay with a test card, see the booking confirmed and paid; force a decline with card `4000 0000 0000 0002`; cancel a paid booking from `/dashboard` and see the refund message; call `GET /api/cron/maintenance` with the bearer secret and read the JSON counts.
6. Check the ledger balances: `select transaction_id, sum(case direction when 'debit' then amount_minor else -amount_minor end) from ledger_entries group by 1 having sum(case direction when 'debit' then amount_minor else -amount_minor end) <> 0` must return no rows.
7. Rollback: redeploy the previous Vercel build. The migration is additive; only new bookings would lose their checkout, so do not roll back once real customers are paying.

## Known limitations

- Real money movement is out of scope: payouts and deposits are simulated and Stripe runs in test mode.
- Stripe confirmation is asynchronous (webhook), so the confirmation page refreshes itself for up to 30 seconds after payment.
- A replayed Stripe checkout (same attempt) does not return the client secret again; the customer simply starts a new attempt.
- Policy and one-way amounts are assumed to be in the provider's default currency, so each currency needs its own provider (as the seeded demo providers do).
- Chargebacks and disputes, receipts and invoices, emails, and payments screens for admins and providers are later sub-projects.
