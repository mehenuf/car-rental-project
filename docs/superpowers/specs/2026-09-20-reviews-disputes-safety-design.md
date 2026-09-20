# Reviews, Disputes and Trust and Safety — Design Spec (sub-project 7)

Date: 2026-09-20
Status: Draft for one combined review (see `2026-09-20-roadmap-5-to-9-overview.md`)
Migration: `0014`. Built after sub-project 6 (it relies on notifications and messaging).
Builds on: the booking lifecycle and inspections (4), the ledger, refunds and the deposit capture function (3), payouts (3).

## 1. Scope

**In:** verified two-way reviews with a fair reveal rule, provider replies, moderation; a dispute process for damage claims and customer complaints that freezes the money in question, collects evidence, and resolves through deposit capture or refund; safety measures for private owners and everyone else (insurance attestation, incident reports, listing and user reports, lightweight risk rules).

**Out:** claims beyond the security deposit (there is no off-session charge of the customer's card), insurance claim handling with a real insurer, identity verification vendors, legal arbitration, automated fraud scoring with machine learning.

## 2. Decisions to confirm

1. **Only completed rentals can be reviewed**, once, by each side, within 14 days of the return. That makes every review verified by construction.
2. **Double-blind reveal.** A review stays hidden until both sides have submitted or the 14 days end, then both appear together. This stops retaliation and inflated politeness. Editing is allowed for 48 hours, and only while still hidden.
3. **What is rated.** Customer to provider: overall (1 to 5) plus cleanliness, accuracy of the listing, communication and value, and a written comment. Provider to customer: overall, care of the car, communication, and a comment. Ratings feed the provider's and the model's averages with a Bayesian average so one review cannot swing a new listing; the existing `vehicles.rating` and `review_count` become derived, updated by trigger from published reviews.
4. **Providers can reply once** to a review of them. Neither side can delete a review; an admin can remove one that breaks the rules (recorded with a reason). Reviews are reportable.
5. **Disputes open within 48 hours after return**, by either side. Types: `damage` (provider claims against the deposit), `cleanliness_or_fees` (provider), `listing_mismatch`, `overcharge`, `service_problem` (customer). Opening a dispute freezes the provider's payout for that booking and stops the deposit being released.
6. **Evidence is structured.** The pickup and return inspections (odometer, fuel, notes, photos) are attached automatically. Each side can add text and up to ten photos. The provider states an amount for a damage claim, capped at the deposit held.
7. **Resolution ladder.** The other party can accept, counter with a lower amount, or contest. If they agree, it resolves itself: the agreed amount is captured from the deposit (`capture_deposit`), the rest of the deposit is released, and the payout is unfrozen. If they do not agree within 72 hours, or either asks, a platform reviewer decides in the admin console (sub-project 8). The decision can capture, refund the customer (`record_refund_success`, taken from the provider's payable), or dismiss. Every step is timed and logged.
8. **Money moves only through existing, ledger-backed functions.** No new way to move funds is introduced; a dispute simply calls capture, refund and unfreeze in one transaction and records that it did.
9. **Insurance attestation.** A private owner must accept a versioned declaration (their car is insured for rental use, the documents are genuine) before any car can be submitted. The acceptance is stored with the version and time.
10. **Trust and safety basics.** Reports of a listing, a user or a message go into a review queue; a provider or customer can be suspended (existing status for providers, a new flag for customers); a small rules table flags bookings for manual review (very high value, several new-account bookings from one device or card fingerprint, mismatched country, back-to-back cancellations). Flagged bookings are held for review before pickup, never silently cancelled.

## 3. Data model (`0014`)

- `reviews(id, booking_id, direction customer_to_provider|provider_to_customer, author_user_id, subject_provider_id null, subject_user_id null, vehicle_id null, overall, aspects jsonb, comment, status hidden|published|removed, submitted_at, published_at, edited_at, removed_reason)`, unique on `(booking_id, direction)`; `review_replies(review_id pk, provider_id, body, created_at)`; `review_reports(id, review_id, reporter_user_id, reason, status)`.
- Aggregates: `provider_rating(provider_id, review_count, bayes_score)` and per-model rollups maintained by trigger; a function `publish_due_reviews()` (called by the daily dispatcher) reveals pairs and expired windows.
- `disputes(id, booking_id unique per open dispute, opened_by_side, type, status opened|awaiting_response|negotiating|escalated|resolved|dismissed, claimed_amount_minor, agreed_amount_minor, currency, resolution capture|refund|dismiss|mixed, deadline_at, resolved_at, resolved_by)`, `dispute_events(id, dispute_id, actor_side, kind message|evidence|offer|accept|contest|escalate|decision, body, amount_minor, photo_paths[], created_at)`.
- Functions (service role only): `open_dispute` (validates the window, freezes the payout, blocks deposit release), `respond_dispute`, `resolve_dispute` (transactional: capture, refund, unfreeze, write events), `expire_disputes` (72-hour auto-escalation).
- Safety: `reports(id, kind listing|user|message|review, target_id, reporter_user_id, reason, status)`, `insurance_attestations(provider_id, version, accepted_by, accepted_at)`, `risk_rules(id, code, threshold jsonb, action hold_for_review|notify, is_active)`, `bookings.risk_flags text[]` and `bookings.risk_status clear|held|cleared`, `profiles_flags(user_id, suspended, reason)`. Deposit release and payouts skip any booking with an open dispute; pickup skips a booking whose risk status is `held`.

## 4. Screens and routes

Customer and provider get a review prompt after completion (email from sub-project 6), a review form, a public reviews section on vehicle and provider pages (localised, with ratings and replies), and a dispute screen (timeline, evidence upload, accept, counter, contest). The provider portal gains Reviews and Disputes pages. The platform admin gets the dispute and report consoles and the risk queue in sub-project 8; this spec defines their data and rules.

## 5. Testing and rollout

- Vitest: Bayesian average maths, reveal rules (both submitted versus window ended), edit window, dispute state machine and deadlines, offer negotiation outcomes and the amount caps, risk-rule evaluation.
- SQL tests: one review per direction, only for completed bookings, hidden until reveal; `open_dispute` freezes the payout and blocks deposit release; `resolve_dispute` for capture, refund, split and dismiss leaves the ledger balanced and the payout in the right state; disputes cannot open after the window or twice; row-level security for evidence and reviews.
- Manual checklist: finish a rental, both sides review, see the reveal; open a damage dispute with photos, negotiate, resolve by agreement and by admin decision; confirm the ledger and payout afterwards.
- Rollout: apply `0014`, deploy, backfill derived ratings once (the seed's static ratings become the starting point), then enable the review email.
