# Provider Onboarding and Portal Implementation Plan (sub-project 4)

> Compact plan. Design: `docs/superpowers/specs/2026-09-20-provider-onboarding-portal-design.md` (approved 2026-09-20). Each phase was built test-first and ended with `npx tsc --noEmit`, `npm run lint`, `npx vitest run` and `npm run test:db` green, then a commit.

**Branch:** `feature/marketplace-core` (builds on migrations 0001 to 0009).

## Phases delivered

- **A. Onboarding:** migration `0010` (onboarding columns, `branch_private`, `fleet_units.listing_status`, `provider_documents`, `payout_accounts`, `booking_inspections`, `record_inspection`, private buckets); permission matrix, provider status machine, required-document and upload rules; `/api/provider/apply|switch|documents|submit`; `/api/admin/providers|documents|units`; `/provider/apply` and `/admin/providers`.
- **B. Portal:** admin shell generalised (nav, root link, login path, topbar slot); `/provider` overview, fleet, calendar and settings with their APIs; time-zone-aware calendar and overview logic.
- **C. Pricing:** rate plans, seasons, extras, policy, promo codes and one-way fees, with tested conversions between what people type and what is stored.
- **D. Operations:** bookings list, inspections with photos, provider cancellation (full refund) and no-show, payouts view, team management (migration `0011`, `find_user_by_email`).

## Deviations from the spec

- Migration `0011` was added for the email lookup used by the team page (the auth schema is not exposed to the API).
- A `bookings.cancel` permission was added: owners and managers can cancel a booking (with a full refund); agents cannot.
- The Storage buckets have no policies. They are private, and only the service role reads or writes them, through short-lived signed URLs the server issues after checking membership.
- Instant booking only, as decided. Approve-first, emailed invitations and requesting a missing catalogue model are deferred.
- The 0011 SQL test was written together with its migration rather than watched failing first.

## Rollout runbook (production Supabase and Vercel)

Prerequisite: migrations `0003` to `0009` applied and their code deployed.

1. Back up production and confirm the backup exists.
2. Rehearse `0010` and `0011` on a copy. Check: `select count(*) from fleet_units where listing_status <> 'approved'` is 0 (existing cars stay live), `select count(*) from branch_private` equals the number of branches that had an address, and `select count(*) from information_schema.columns where table_name = 'branches' and column_name = 'address'` is 0.
3. Apply `0010` and `0011`, then deploy. The previous release keeps working, except that it reads the dropped `branches.address` column if any code selected it (nothing in the app does).
4. Confirm the two Storage buckets exist and are private (Supabase dashboard, Storage). If the migration ran where the Storage schema was absent, create `provider-documents` and `booking-inspections` by hand as private buckets.
5. Make yourself a platform admin as before (`npx tsx promote-admin.ts you@example.com`), then smoke test: apply as a company from a second account, upload two documents, submit, approve at `/admin/providers`, add a car with a price, open the calendar, book it from the public site, hand it over and take it back, and check the payout appears under Payouts.
6. For a private owner: apply as an individual, add a car, upload its registration and insurance, submit it, approve the car in the admin dialog, open availability days, and book it.
7. Rollback: redeploy the previous Vercel build. The migrations are additive apart from moving `branches.address`, so restoring the backup is only needed if `0010` itself must be undone.

## Known limitations

- Documents are reviewed by hand and the demo does no real identity verification.
- Availability windows and blocks use the branch time zone; a branch's time zone is set when it is created and cannot yet be edited in the portal.
- The overview's earnings ignore partial refunds.
- Provider policy, extras and promo amounts are in the provider's default currency; a provider with branches in several currencies would need one account per currency.
- Nothing here has run against a real Supabase or in a browser; the SQL, permission rules, conversions and calendar logic are tested, the screens and API routes are type-checked and linted only.
