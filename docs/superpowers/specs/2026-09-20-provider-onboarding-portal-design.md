# Provider Onboarding and Portal — Design Spec (sub-project 4)

Date: 2026-09-20
Status: Draft for review
Parent: `2026-09-19-marketplace-platform-design.md` sections 5 and 5b.
Builds on: sub-projects 1 to 3 (providers, members, branches, fleet units, rate plans, payouts, RLS).

## 1. Scope

**In:** a way for a company or a private individual to apply as a provider and be approved; a provider portal at `/provider` where staff manage their fleet, branches, availability, pricing, bookings, payouts and team; a minimal platform-admin review queue at `/admin/providers` (grown in sub-project 8) so approval works end to end.

**Out (owner):** approve-first bookings (needs card authorise-then-capture; instant booking only for now); emailed invitations and notifications (6); reviews, disputes and messaging (7 and 6); analytics beyond a KPI overview (8); real identity checks (documents are reviewed by hand, as in the demo scope).

## 2. Decisions to confirm

1. **Instant booking only.** The "approve first" option in the parent spec needs an authorisation-then-capture payment flow. It is deferred. Every listing books instantly, as today.
2. **Per-car approval.** Companies are approved once, and their cars are live at once (as today). A private individual is approved as a person, and **each car is approved separately**. `fleet_units` gets a `listing_status` (`draft`, `pending_review`, `approved`, `rejected`). Existing units are backfilled `approved`. `free_units` only offers `approved` units of `approved` providers.
3. **Minimal admin queue now.** `/admin/providers` lists applications with their documents, and lets a platform admin approve, reject (with a written reason) or suspend a provider, and approve or reject an individual's car. Filters, audit trail and reports come in sub-project 8.
4. **Private documents.** Uploaded documents go to a private Supabase Storage bucket `provider-documents`, under `{provider_id}/`. The server checks membership and hands out short-lived signed upload and download URLs. Limits: 5 MB, PDF, JPG or PNG. A `provider_documents` table records each file and its review status.
5. **Address privacy.** `branches.address` moves to `branch_private(branch_id, address)` with member-only access, so a private owner's exact address is never publicly readable. It is shown to the customer only after a booking is paid (wired up in sub-project 5).
6. **Team = existing accounts.** An owner adds a colleague by the email of an existing account and picks a role (`manager` with an optional branch, or `agent`). Emailed invitations wait for sub-project 6.
7. **Catalogue-only models.** A provider lists cars by choosing a model from the platform catalogue. Requesting a missing model is a note to the admin for now, not an automated flow.
8. **Authorisation is checked twice.** RLS already protects the tables. Every `/api/provider/*` route also resolves the caller's memberships and role on the server, never trusts a provider id from the request body without a membership check, and filters every query by `provider_id`. The active provider is kept in a signed cookie and re-validated on each request, so a user who belongs to several providers can switch.
9. **Four shippable phases**, each with its own tests and commit range: (A) apply, documents, admin review; (B) portal shell, fleet, branches, availability and calendar; (C) pricing management; (D) bookings operations with inspections, payouts view and team.

## 3. Data model (migration 0010)

- `providers` gains `registration_number`, `contact_phone`, `submitted_at`, `reviewed_at`, `review_note`.
- `branch_private(branch_id pk, provider_id, address)` with RLS (members only); `branches.address` is copied over and dropped.
- `fleet_units.listing_status` (default `approved` for backfill; new individual cars start `draft`). `free_units` gains the `listing_status = 'approved'` condition.
- `provider_documents(id, provider_id, fleet_unit_id null, kind, storage_path, file_name, mime_type, size_bytes, status pending|accepted|rejected, review_note, created_at)`. Kinds: `business_licence`, `id_document`, `drivers_licence`, `vehicle_registration`, `insurance`.
- `payout_accounts(provider_id pk, account_holder, bank_name, account_last4, country_code)`: masked details only, since payouts are simulated.
- `booking_inspections(id, booking_id, kind pickup|return, odometer_km, fuel_level, notes, photo_paths text[], created_by, created_at)`, unique `(booking_id, kind)`. Recording a pickup inspection moves the booking to `active`; a return inspection moves it to `completed` and updates the unit's mileage. Both go through `transition_booking`.
- Storage bucket and policies for `provider-documents` and `booking-inspections` (private, member access under their own provider folder).

## 4. Server structure

- `src/lib/provider/context.ts`: `getProviderContext()` (session user, memberships, active provider) and `requireProviderAccess(roles)`, plus pure role-check helpers with unit tests.
- Routes under `/api/provider/...` (application, documents upload and download URLs, branches, units, availability windows, rate plans, seasons, extras, policy, one-way fees, promo codes, bookings, inspections, payouts, team, payout account) and `/api/admin/providers/...` (list, review, suspend, review a car). All inputs validated with Zod.
- Pages under `src/app/provider/`, using the existing admin shell components with a provider navigation list and a provider switcher. Individual owners see a simplified navigation (My cars, Availability, Requests, Earnings, Settings) from the same code.

## 5. Testing and rollout

- Vitest: role and permission helpers, request schemas, inspection-to-transition mapping, document validation (type and size).
- SQL tests: `listing_status` gating in `free_units`, `branch_private` RLS, document and inspection constraints and RLS, that an individual's unapproved car is never offered.
- Manual checklist per phase against a staging Supabase: apply as a company and as an individual, upload documents, approve as admin, add a car, set a price, book it from the public site, run the pickup and return inspections, see the payout.
- Rollout: apply `0010`, create the two Storage buckets (the migration creates them where the Supabase Storage schema is present), deploy.
