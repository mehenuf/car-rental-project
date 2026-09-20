# Reviews, Disputes and Safety Implementation Plan (sub-project 7)

> Compact plan. Design: `docs/superpowers/specs/2026-09-20-reviews-disputes-safety-design.md` (approved 2026-09-20). Built in phases; each ended with `npx tsc --noEmit`, `npm run lint`, `npx vitest run` and `npm run test:db` green, then a commit.

**Branch:** `feature/marketplace-core` (builds on migrations 0001 to 0013).

## Phases delivered

- **Follow-ups to earlier sub-projects (in `0014`):** `expire_licences()` (run by the daily cron) and licence decision events; return reminders (`enqueue_due_reminders` now also covers active rentals due back within 24 hours); templates for `licence_verified`, `licence_rejected`, `licence_expired`, `return_reminder` and `review_request` in all 11 languages.
- **A. Rules (pure, tested):** `src/lib/reviews/rules.ts` (Bayesian average identical to the database, 14-day window, double-blind reveal, 48-hour edit window, rating schemas), `src/lib/disputes/rules.ts` (types per side, 48-hour opening window, 72-hour deadline, who may respond, five-offer limit, resolution by type, schemas), `src/lib/disputes/service.ts` (resolution orchestration with injected ports: the provider step first, the database record last, per-dispute refund key), `src/lib/trust-errors.ts`.
- **B. Migration `0014` and SQL tests (`12_reviews_disputes_safety`):** reviews (one per side per booking, completed bookings only, hidden until both reviewed or the window ends, editable for 48 hours while hidden), provider replies (once), review reports, `provider_ratings` and derived `vehicles.rating` by trigger; disputes and their timeline with functions `open_dispute`, `respond_dispute`, `escalate_dispute`, `expire_disputes`, `resolve_dispute` (capture uses the existing `capture_deposit`; a refund is made through the refund flow first and recorded here; the payout is frozen while open and released or reduced on resolution); reports, insurance attestations (a private owner cannot submit a car without one), user suspension flag (blocks new bookings), risk rules with `risk_flags` and `risk_status` (a held booking cannot be handed over until cleared); row-level security for parties and public reads of published reviews.
- **C. Server:** `refundAmount` and `captureDepositForBooking` in the payments service (tested), deposits are not released while a dispute is open, routes for reviews, disputes, reports, attestation and `/api/admin/trust`; the daily cron publishes due reviews and escalates unanswered disputes.
- **D. Screens:** review form and dispute panel on the renter's trip page (translated), reviews with replies on the vehicle page, provider Reviews and Disputes pages, insurance declaration in provider settings for private owners, admin Trust and safety page (disputes for decision, reports, held bookings).

## Deviations from the spec

- **Evidence photos:** the API accepts photo paths and the pickup and return inspection photos are attached automatically, but there is no separate upload screen for dispute evidence yet (text evidence only).
- **Notifications:** only the review request is emailed. Dispute opened, replied and decided notices are not sent yet, so the other side finds out by opening the page.
- **Reporting:** the report API exists but no screen has a "report" button yet. Suspending a customer is an API action (`suspend_user`) with no search screen.
- **Risk rules:** three of the four rules are built (very high value, repeated guest bookings, repeated cancellations). Country mismatch and card fingerprint need data the demo does not have.
- **Provider ratings** are computed and stored (`provider_ratings`) but only the vehicle's reviews are shown publicly; a provider page does not exist yet. Reviews of renters are stored and published but shown nowhere yet.
- **Resolution "mixed"** (part capture, part refund in one decision) is not supported; a reviewer decides one kind of resolution.
- **Refund resolution for renter complaints** does not take money back from a payout that was already paid; disputes open only before the 48-hour payout release, so this cannot occur.
- **Stripe deposit capture** is called through the provider interface, but has not run against real Stripe (the simulated provider's capture is a no-op).
- **Self-service booking changes stay deferred** (see the sub-project 5 plan).
- SQL tests for `0014` were written after the migration.

## Rollout runbook

1. Rehearse `0014` on a copy. It adds tables, functions and triggers, plus `bookings.risk_flags` and `bookings.risk_status` (defaults make existing rows `clear`).
2. Existing private owners with cars in review: the new gate applies to future submissions only. Ask owners to accept the declaration in Settings, Insurance.
3. Apply `0014` and deploy. `vehicles.rating` and `review_count` become derived the first time a vehicle's review is published; until then the seeded values remain (no backfill).
4. Tune `risk_rules` (the seeded thresholds are examples: total of 5000 or more, three guest bookings in 24 hours, three cancellations in 7 days) and decide who reviews `/admin/trust`.
5. Smoke test: complete a rental, review from both sides and watch the reveal; open a damage dispute, negotiate, accept, and check the deposit capture and the payout; escalate one and decide it in `/admin/trust`.
6. Rollback: redeploy the previous build. The triggers stay; reviews and disputes tables are unused by the old code, but a held booking would still block pickup in the database.

## Known limitations

- Nothing here has run against a real Supabase, Stripe or browser: SQL, pure rules and the dispute and payment service (with fakes) are tested; routes and screens are type-checked, linted and built.
- An abandoned dispute is escalated after 72 hours by the daily cron, so on the Hobby plan an escalation can be up to a day late.
