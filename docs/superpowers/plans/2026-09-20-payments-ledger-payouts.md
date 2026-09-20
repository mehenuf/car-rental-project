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
