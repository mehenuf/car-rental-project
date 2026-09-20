# Platform Admin and Operations Implementation Plan (sub-project 8)

> Compact plan. Design: `docs/superpowers/specs/2026-09-20-platform-admin-operations-design.md` (approved 2026-09-20). Built in phases; each ended with `npx tsc --noEmit`, `npm run lint`, `npx vitest run` and `npm run test:db` green, then a commit.

**Branch:** `feature/marketplace-core` (builds on migrations 0001 to 0014).

## Phases delivered

- **A. Migration `0015` and SQL tests (`13_platform_admin`):** `platform_staff` with four roles and `staff_role()`; an append-only `audit_log` (update, delete and truncate are refused) with `audit_write()` and triggers on providers, payouts, staff, customer flags, approvals and platform settings; `approvals` with the four-eyes rule enforced by a database check and `decide_approval()` (approving a fee change applies it in the same transaction, with a `settings_history` row); `fx_rates`; `model_requests`; per-currency report views (`v_revenue_by_month_currency`, `v_gmv_take_rate`, `v_refunds_by_month`, `v_payouts_by_provider`, `v_tax_collected_by_country`, `ledger_entries_export`); ledger integrity functions `fn_trial_balance`, `fn_reconcile_payments`, `fn_reconcile_payouts`; existing admins become super admins.
- **B. Rules (pure, tested):** `src/lib/admin/` permission matrix, approval thresholds (per role, converted by currency exponent) and who may decide, CSV escaping with formula defusing and streaming, currency grouping and a labelled approximate total, reconciliation problems, audit row building with secret redaction, the export catalogue and date-range validation.
- **C. Server:** `requireStaff(permission)` (admin claim, active role, permission, and a completed second factor), `writeAudit`, and routes for reports, streamed CSV exports, the audit log, staff management (with a guard that the last active super admin cannot be removed), approvals (a dispute decision is carried out on approval), platform settings changes (always through an approval) and FX rates. The trust, licence, provider, document and car review routes now check a specific permission and write audit entries. `requireAdmin` (used by the original dashboard APIs) now means active staff plus second factor.
- **D. Screens:** Reports (integrity, revenue, volume and take rate, refunds, payouts, tax, approximate total, CSV exports), Approvals, Audit log, Staff, Settings (fees, exchange rates, history) and a two-factor page; the proxy sends staff without a completed second factor to `/admin/mfa`.

## Deviations from the spec

- **Consoles not built:** separate Customers, Bookings (force-cancel and refund), Payments and refunds (retry a failed refund), Payouts (run, hold, release), Catalogue and model-request, Promotions and tax-rule, and Health consoles. Their permissions, audit and approval rules exist and the data is exported and reported, but there are no screens for those actions yet. The existing Sales page still lists bookings.
- **Dashboard totals:** the original dashboard cards and best sellers still add bookings without regard to currency. The corrected per-currency figures are on the new Reports page; retiring the old mixed cards is a follow-up.
- **Navigation is not filtered by role.** Every item shows, and the API enforces each role's permissions (a role without access gets a clear error).
- **Settings:** only the commission and service fee are governed. The 15-minute hold, dispute windows and reminder timings are still constants in code and SQL.
- **Approval limits are code constants** (100, 100, 1000 and 10,000 whole currency units for support, reviewer, finance and super admin), not editable settings. Manual refunds and payout releases have no console yet, so today only dispute decisions and fee changes use approvals in practice.
- **Daily reconciliation alert:** the checks run on demand when Reports opens; they are not scheduled or alerting yet. The health check page is not built.
- **Two-factor enforcement** depends on Supabase TOTP and has not been tried against a real project. `ADMIN_REQUIRE_MFA=false` turns it off for local development; leave it on in production.
- SQL tests for `0015` were written after the migration.

## Rollout runbook

1. Rehearse `0015` on a copy. Check `select count(*) from platform_staff` equals the number of accounts with `app_metadata.role = 'admin'`.
2. Apply `0015` and deploy. Every existing admin is now a super admin and is sent to `/admin/mfa` on their next visit to enrol an authenticator app. Do this yourself first and confirm you can get back in before telling others; `ADMIN_REQUIRE_MFA=false` is the escape hatch.
3. Add finance, support and reviewer staff under Staff (they need an existing account; the admin claim is set for them).
4. Enter FX rates under Settings if you want the approximate totals in Reports.
5. Open Reports and confirm the ledger integrity section shows no problems. Any difference names the check and the currency.
6. Rollback: redeploy the previous build. The triggers keep writing to the audit log, which is harmless; nothing in the old code reads the new tables.

## Known limitations

- Nothing here has run against a real Supabase or browser: SQL, pure rules and permission logic are tested; routes and screens are type-checked, linted and built.
- Exports read pages of 1,000 rows at a time; very large ranges are slow but bounded by the one-year limit.
