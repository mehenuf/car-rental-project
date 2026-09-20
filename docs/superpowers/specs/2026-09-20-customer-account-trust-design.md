# Customer Account and Trust — Design Spec (sub-project 5)

Date: 2026-09-20
Status: Draft for one combined review (see `2026-09-20-roadmap-5-to-9-overview.md`)
Migration: `0012`. Built after part A of the localisation spec (9a), so every screen here uses message keys from the start.
Builds on: sub-projects 1 to 4; uses Resend for account emails (configured in Supabase Auth), and Twilio phone verification once sub-project 6 exists.

## 1. Scope

**In:** real email verification and password reset; a customer area at `/{lang}/account` (trips, trip details, profile, driver's licence, receipts, security); self-service changes to a booking; claiming guest bookings; showing the private pick-up address and provider contact after payment; receipts; driver's licence and age verification that gates pickup; optional TOTP two-factor sign-in.

**Out (owner):** emails and SMS themselves (6), reviews and disputes (7), data export and account deletion (9b), staff review tooling beyond a basic queue (8), real identity or licence verification vendors (the demo reviews by hand).

## 2. Decisions to confirm

1. **Real email verification.** Supabase Auth is switched to require email confirmation, with Resend as its SMTP server and templates customised and localised. The pre-confirmed-account workaround in `POST /api/auth/signup` is removed; signup creates an unconfirmed account and the customer clicks the link. Password reset uses the same path. Passwords need at least 10 characters and are checked against known breaches (Have I Been Pwned k-anonymity check on the server) on signup and change.
2. **One account area replaces `/dashboard`.** `/dashboard` redirects to `/{lang}/account`. Guests still book without an account, as today.
3. **Claiming guest bookings.** After a customer signs in (or signs up and verifies) with the same email a guest booking used, they are offered to attach those bookings. The email must be verified, so nobody can claim someone else's booking by typing their address.
4. **Licence verification gates pickup.** A customer must have a verified driver's licence before a car is handed over. The pickup inspection (`record_inspection`) refuses when the booking's account has no verified licence, unless the provider records an override reason (logged). Guests must claim their booking to an account first. Reviews of licences are manual by a platform reviewer; the demo does not read documents automatically.
5. **Age is checked from the licence's date of birth**, not only from the age typed when quoting. If the verified age is below the provider's minimum age, pickup is blocked. If it falls in the provider's young-driver band but the quote did not include that fee, the provider is warned and can charge it at the counter (recorded on the booking); automated supplements are out of scope.
6. **Self-service changes = dates and extras until the free-cancellation deadline.** A customer can move or shorten or extend a booking, or change extras, until the provider's earliest cancellation-tier deadline before pickup, provided the same car stays available. The change is re-quoted; a higher total is collected as a supplement charge through the existing payment flow, a lower total is refunded. Each change stores a new immutable price snapshot (`booking_revisions`); payouts and refunds always use the latest snapshot, and history is preserved.
7. **Receipts, not tax invoices.** The platform issues a receipt per payment (numbered `R-YYYY-000001`, gapless per year) with the itemised quote. Tax invoices for the rental are the provider's responsibility as merchant of record; the platform's own service-fee invoice is generated only when a service fee is charged. Receipts are printable HTML pages (print stylesheet), no PDF library.
8. **The private address is revealed only after payment,** through the account trip page (and later in emails), read from `branch_private`. Provider phone appears at the same moment. Never in search, quotes or the checkout.
9. **MFA optional for customers** (TOTP through Supabase), shown under Security.

## 3. Data model (`0012`)

- `driver_profiles(user_id pk, date_of_birth, licence_country, licence_number_last4, licence_expiry, status unverified|pending|verified|rejected|expired, review_note, reviewed_at, reviewed_by)` and `driver_documents(id, user_id, kind licence_front|licence_back|selfie, storage_path, mime_type, size_bytes, created_at)` in a private `customer-documents` bucket under `{user_id}/`. A nightly step marks licences past their expiry as `expired`.
- `booking_revisions(id, booking_id, revision, snapshot jsonb, total_delta_minor, created_at, created_by)`, unique on `(booking_id, revision)`; `bookings` gains `revision int default 1`.
- `receipts(id, number unique, booking_id, payment_id unique, issued_at, snapshot jsonb)` with a per-year counter function so numbers are gapless.
- `guest_claims(id, user_id, booking_id, claimed_at)` as an audit record of claims.
- Functions (service role only): `modify_booking_atomic(booking, new_pickup, new_dropoff, snapshot)` (checks availability while ignoring the booking's own occupancy, moves the occupancy range, updates dates, writes a revision), `claim_guest_bookings(user_id, email)` (only for a verified email), `issue_receipt(payment_id)`. `record_inspection` gains the licence and age gate.
- Policies: members read nothing here; customers read their own rows through server routes only.

## 4. Server and screens

- Routes: `GET/PATCH /api/account/profile`, `GET /api/account/bookings` and `/{id}` (address and provider contact only when paid), `POST /api/account/bookings/{id}/modify` (returns the re-quote first, then confirms with a signed token, reusing the quote-token mechanism), `POST /api/account/claim`, `GET/PUT /api/account/driver` and `POST /api/account/driver/documents` (signed upload URLs like provider documents), `GET /api/account/receipts/{id}`.
- Pages: `/{lang}/account` (upcoming and past trips), `/account/trips/{reference}` (details, address, actions: change, cancel, receipt, message provider once sub-project 6 exists), `/account/profile`, `/account/driver`, `/account/security`. The platform admin gets a basic licence review queue at `/admin/licences` (expanded in sub-project 8).
- Email templates that depend on this (verification, reset, receipts) are defined in sub-project 6.

## 5. Testing and rollout

- Vitest: modification pricing rules (deadline, delta sign, supplement versus refund), age computation from date of birth across time zones, licence status transitions, receipt numbering format, breached-password check with a mocked response.
- SQL tests: `modify_booking_atomic` (availability including own range, occupancy moved, revision stored, conflict rejected), `claim_guest_bookings` (verified email only), licence gate in `record_inspection` (blocked, allowed after verification, override recorded), receipt numbering, bucket privacy.
- Manual checklist: sign up and verify by email, reset a password, claim a guest booking, upload a licence, get it approved, change a booking with a supplement and with a refund, view the address before and after payment, complete pickup.
- Rollout: verify the sending domain and set Supabase SMTP (see the overview), apply `0012`, deploy, and turn on "Confirm email" in Supabase last so existing users are not locked out mid-deploy (existing users are marked confirmed by the migration).
