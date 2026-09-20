# Payments, Ledger and Payouts — Design Spec (sub-project 3)

Date: 2026-09-20
Status: Draft for review
Parent: `2026-09-19-marketplace-platform-design.md` section 5 (payout flow) and the product decision "platform collects, pays out providers, simulated payments in a production-grade design".
Builds on: sub-project 1 (booking engine, `transition_booking`) and sub-project 2 (`price_snapshot`, quote engine).

## 1. Scope

**In:** a payment-provider abstraction with two implementations (Stripe in test mode, and a deterministic simulated provider for local and international methods), checkout for a pending booking, a 15-minute unpaid hold, a security-deposit hold with release and capture, refunds computed from the booking's cancellation policy, an append-only double-entry ledger, provider payouts created after completion and a dispute window, and the API and checkout page that tie them together.

**Out (owner in brackets):** real Stripe Connect onboarding and real bank transfers (payouts are simulated); chargebacks and disputes (7); invoices and PDF receipts and all email or SMS (6); admin and provider screens for payments and payouts (8 and 4); 3-D Secure beyond what Stripe's own components do; multi-currency reporting.

## 2. Decisions to confirm

1. **Stripe is optional.** With `STRIPE_SECRET_KEY` set (test keys), card and wallet payments go through Stripe test mode. Without it the site still works with only the simulated methods, so the showcase never depends on a Stripe account. No card data ever touches our servers or database (Stripe Elements, PCI SAQ-A).
2. **Simulated methods** are shown by branch country and currency: card (test), PayPal, Apple Pay, Google Pay, bKash, UPI, iDEAL, M-Pesa. The simulated provider behaves like a real one: intents with states, deterministic outcomes chosen by a documented test value (for example a card ending `0002` declines, `9995` fails for insufficient funds, others succeed), asynchronous-style confirmation, and refunds.
3. **Booking flow.** Customer fills contact details and the server creates a `pending` booking with a **15-minute hold** (`hold_expires_at`). They are redirected to `/checkout/[reference]`, pay, and the booking becomes `confirmed`. Unpaid holds expire: `expire_stale_holds()` cancels them and frees the car. It runs at the start of every booking and from a protected cron endpoint, so no scheduler is required for correctness.
4. **Idempotency.** Every payment action carries an idempotency key, unique in the database. Webhooks and repeated clicks cannot double-charge, double-refund or double-post the ledger.
5. **Deposit.** The quote's deposit is authorised as a hold at checkout (Stripe manual capture, or a simulated hold), not charged. It is released when the booking completes and the dispute window (48 hours) passes, or captured in part or in full by a later damage flow (sub-project 7 will call the capture function).
6. **Refunds** follow the cancellation tiers stored in the booking's `price_snapshot`: `refund = mulBp(total, tier.refundBp)` for the tier that applies to the time before pick-up. The provider payable and the platform commission are reversed in the same proportion. A no-show or a tier of 0% refunds nothing.
7. **Ledger.** Double-entry, integer minor units, append-only (updates and deletes are rejected by trigger), and every transaction must balance (checked by a deferred constraint). Accounts are per provider where money belongs to a provider. Reports and payouts are computed from the ledger, never from mutable columns.
8. **Payouts.** When a booking completes, a payout of the provider's share (from the snapshot, less any refunds) is created as `pending` with `release_after = completed_at + 48h`. `run_payouts()` pays every due payout (simulated bank transfer, immediately `paid`), skips any frozen by a dispute, and posts the ledger entries. Tax stays with the provider, as decided in sub-project 2.
9. **Extra payment methods in the database.** `bookings.payment_method` is widened to the new method list.

## 3. Data model (migration 0009)

- `payments(id, booking_id, kind charge|deposit_hold|refund, method, provider stripe|simulated, provider_ref, status requires_action|processing|succeeded|failed|cancelled|released|captured, amount_minor, currency, idempotency_key unique, failure_code, created_at, updated_at)`.
- `payment_events(id, payment_id, type, payload jsonb, created_at)`: append-only log of provider callbacks and state changes.
- `ledger_accounts(id, code unique, provider_id null, kind asset|liability|income|expense)`, created on demand per provider. Codes: `psp_cash` (asset), `provider_payable` (liability, per provider), `deposit_liability` (liability), `platform_revenue` (income), `provider_paid_out` (asset outflow, per provider).
- `ledger_transactions(id, booking_id, kind, memo, created_at)` and `ledger_entries(id, transaction_id, account_id, direction debit|credit, amount_minor, currency)`. Deferred constraint: per transaction, debits equal credits. Update and delete are blocked.
- `payouts(id, provider_id, booking_id unique, amount_minor, currency, status pending|paid|frozen|cancelled, release_after, paid_at)`.
- `bookings` gains `payment_status unpaid|paid|refunded|partially_refunded`, `hold_expires_at`, `completed_at`.
- SQL functions (service role only): `post_ledger_transaction`, `expire_stale_holds`, `record_payment_success(payment_id)` (marks the payment paid, confirms the booking, posts the ledger), `create_payout_for_booking`, `run_payouts`.

Ledger postings (all in the booking currency):

| Event | Debit | Credit |
|---|---|---|
| Charge succeeds (total) | `psp_cash` total | `provider_payable` (total - service fee - commission), `platform_revenue` (commission + service fee) |
| Deposit hold captured (amount) | `psp_cash` amount | `deposit_liability` amount |
| Deposit released | `deposit_liability` amount | `psp_cash` amount |
| Refund (amount R of total T) | `provider_payable`, `platform_revenue` in proportion | `psp_cash` R |
| Payout paid | `provider_payable` amount | `provider_paid_out` amount |

## 4. Code layout (`src/lib/payments/`)

- `types.ts` and `provider.ts`: the `PaymentProvider` interface (`createPayment`, `confirmPayment`, `authorizeDeposit`, `releaseDeposit`, `captureDeposit`, `refund`, `parseWebhook`).
- `stripe-provider.ts` and `simulated-provider.ts`; `registry.ts` chooses by method and by whether Stripe is configured.
- `refunds.ts`: pure `computeRefund(snapshot, cancelledAt, pickupAt)`.
- `postings.ts`: pure builders that turn a snapshot and an event into balanced ledger lines (unit tested for balance).
- `service.ts`: server-side orchestration (start checkout, confirm, cancel-and-refund, complete-and-create-payout).
- Routes: `POST /api/payments/intents`, `POST /api/payments/[id]/confirm` (simulated), `POST /api/webhooks/stripe`, `POST /api/cron/expire-holds` and `POST /api/cron/run-payouts` (both protected by `CRON_SECRET`).
- UI: `/checkout/[reference]` (method picker, Stripe Elements or the simulated form, deposit notice, countdown of the hold), and `/booking-confirmation` showing paid status.

## 5. Testing and rollout

- Vitest: simulated provider outcomes, refund tiers, ledger posting balance for every event, idempotent service calls (with an in-memory fake of the persistence layer), Stripe webhook signature parsing.
- SQL tests: ledger is append-only and balances, `expire_stale_holds` frees units, `record_payment_success` is idempotent, payout timing and freezing, RLS.
- Manual checklist against a staging Supabase: pay with each simulated method, force a decline, let a hold expire, cancel inside and outside a refund tier, complete a booking and run payouts.
- Rollout: apply `0009`, add `CRON_SECRET` (and optionally the Stripe test keys) in Vercel, deploy, add a Vercel cron for `expire-holds` and `run-payouts`, smoke test.
