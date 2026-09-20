# Customer Account and Trust Implementation Plan (sub-project 5)

> **For agentic workers:** execute inline, phase by phase, test first. Each phase ends with `npx tsc --noEmit`, `npm run lint`, `npx vitest run` and `npm run test:db` green, then a commit.

**Goal:** real email verification, a customer account area, licence and age verification that gates pickup, self-service booking changes, receipts, and claiming guest bookings.

**Architecture:** pure rules first (age, licence status, modification pricing, receipt numbers, password policy) in `src/lib/account/`; database functions in migration `0012` for everything that must be atomic (modify, claim, receipt numbering, pickup gate); thin routes under `/api/account/*`; screens under `src/app/[lang]/(site)/account/*`, built with message keys from the first line (all 11 languages, machine-drafted, parity-tested).

**Tech Stack:** Next.js 16 (`proxy.ts`, async params, `[lang]` root params), Supabase (Postgres, Auth, Storage), Zod 4, Vitest 3, the existing SQL test runner (`npm run test:db`).

**Spec:** `docs/superpowers/specs/2026-09-20-customer-account-trust-design.md` (approved 2026-09-20).

## Global Constraints

- Money is integer minor units; use `src/lib/pricing/money.ts` (`mulBp`, `formatMinor`). Only 0- and 2-decimal currencies.
- Passwords: at least 10 characters, checked against Have I Been Pwned by k-anonymity (only the first 5 hex characters of the SHA-1 leave the server).
- Receipt numbers `R-YYYY-000001`, gapless per year.
- Row types in `src/types/database.ts` are `type`, not `interface`. Functions are service-role only (`revoke ... from public, anon, authenticated`).
- Every visible string uses `t()` keys from `src/messages/en.json`; the parity test must stay green for all 11 languages. Physical CSS utilities are forbidden in translated areas (guard test).
- Storage buckets are private with no policies; the server issues short-lived signed URLs after checking ownership.
- Existing users are marked email-confirmed by the migration so turning on "Confirm email" cannot lock them out.

## Phase A: pure rules (test first)

Files: `src/lib/account/{age,licence,modify,receipt,password}.ts` with `*.test.ts` beside each.

- `age.ts`: `ageOn(dob: string, on: Date, timeZone: string): number`; `checkDriverAge(ageYears, {minAge, youngDriverMaxAge?}): "ok" | "young_driver_band" | "too_young"`.
- `licence.ts`: `LicenceStatus = "unverified" | "pending" | "verified" | "rejected" | "expired"`; `canTransition(from, to, actor: "customer" | "reviewer" | "system"): boolean`; `isLicenceValidOn(profile: {status, licenceExpiry}, on: Date, rentalEnd: Date): boolean` (verified and not expiring before the rental ends).
- `modify.ts`: `modificationDeadline(pickupAt: Date, tiers: CancellationTier[]): Date | null` (the earliest full-refund tier deadline, or null when there is no free window); `canModify(now, pickupAt, tiers, status): {ok: true} | {ok: false, reason}`; `settleDelta(oldTotalMinor, newTotalMinor): {kind: "supplement" | "refund" | "none", amountMinor}`.
- `receipt.ts`: `formatReceiptNumber(year: number, sequence: number): string`; `parseReceiptNumber(n: string): {year, sequence} | null`.
- `password.ts`: `passwordProblem(password: string): "too_short" | null`; `checkBreached(password, fetchFn): Promise<{breached: boolean, count: number}>` using the range API and an injected `fetch`; a network failure fails open (returns not breached) so signup never depends on that service.

## Phase B: migration 0012 and SQL tests

`migrations/0012_customer_account.sql`, tests `tests/sql/10_customer_account.test.sql`.

- Tables: `driver_profiles`, `driver_documents`, `booking_revisions` (unique `(booking_id, revision)`), `receipts` (unique `number`, unique `payment_id`), `guest_claims`, `receipt_counters(year pk, last int)`; `bookings.revision int not null default 1`. RLS on, no member policies.
- Functions (service role only): `issue_receipt(p_payment_id uuid) returns receipts` (idempotent, gapless via the counter row lock); `claim_guest_bookings(p_user_id uuid, p_email text) returns int` (only bookings with that email and no user, records `guest_claims`); `modify_booking_atomic(p_booking_id, p_new_pickup, p_new_dropoff, p_snapshot jsonb, p_total_delta_minor int, p_actor uuid) returns bookings` (re-checks availability ignoring the booking's own occupancy, moves the occupancy range, writes a revision); `record_inspection` gains the licence and age gate with an override reason.
- Data step: mark existing `auth.users` rows confirmed.
- Tests: modify moves occupancy and stores a revision, a conflicting move is rejected and leaves everything unchanged; claim attaches only matching bookings; receipt numbers are gapless and repeat calls return the same receipt; the pickup gate blocks without a verified licence, passes after verification, and records an override.

## Phase C: server

- `src/lib/account/service.ts` with injected ports (`AccountDeps`), tested with fakes: `getTrip`, `modifyBooking` (re-quote, deadline check, supplement charge or refund through the payments service, revision), `claimGuestBookings`, `submitLicence`, `reviewLicence`.
- Routes: `GET/PATCH /api/account/profile`, `GET /api/account/bookings`, `GET /api/account/bookings/[id]`, `POST /api/account/bookings/[id]/modify`, `POST /api/account/claim`, `GET/PUT /api/account/driver`, `POST /api/account/driver/documents`, `GET /api/account/receipts/[id]`; `/api/admin/licences` for the review queue.
- `POST /api/auth/signup` stops pre-confirming, applies the password policy and breach check; the address and provider contact are returned only when the booking is paid.

## Phase D: screens and translations

- `/{lang}/account` (trips), `/account/trips/[reference]`, `/account/profile`, `/account/driver`, `/account/security` (TOTP enrolment); `/dashboard` redirects; receipt print page; `/admin/licences` queue.
- New `account.*` message keys in all 11 languages; the header account menu points to `/account`; login, register and provider-apply pages get translated here because this sub-project rebuilds them.

## Deviations, rollout and limitations

Recorded at the end of the build in this file.
