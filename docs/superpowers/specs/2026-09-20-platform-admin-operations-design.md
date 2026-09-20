# Platform Admin and Operations — Design Spec (sub-project 8)

Date: 2026-09-20
Status: Draft for one combined review (see `2026-09-20-roadmap-5-to-9-overview.md`)
Migration: `0015`. Built after sub-project 7 (the consoles for disputes, reviews and risk sit on its data).
Builds on: the existing `/admin` app (dashboard, vehicles, bookings, leads) and the minimal provider review queue from sub-project 4.

## 1. Scope

**In:** staff roles with two-factor sign-in; an append-only audit log that every staff action and sensitive system action writes to; consoles for providers, customers, bookings, payments and refunds, payouts, disputes, risk, reviews, licences, catalogue, and platform settings; financial reports and exports that respect currencies; operational tools.

**Out:** building a customer-support ticket system (staff use the messaging and email from 6), business-intelligence tooling beyond the reports listed, real accounting-system integration (an export is provided instead).

## 2. Decisions to confirm

1. **Staff roles in a table, not one flag.** `platform_staff(user_id, role)` with roles `super_admin`, `support`, `finance`, `reviewer`. The existing `app_metadata.role = 'admin'` claim stays as the gate for entering `/admin` (set only by the service role), and the table decides what each person may do inside. A permission matrix (like the provider one) is unit-tested.
   - `reviewer`: providers, cars, licences, documents, reviews, reports, risk queue, disputes.
   - `support`: read customers and bookings, cancel and refund within a limit, resolve disputes up to a limit, message users.
   - `finance`: payments, refunds, payouts, ledger, reports, exports, fees and tax rules.
   - `super_admin`: everything, including staff management and settings.
2. **Two-factor sign-in for all staff** (Supabase TOTP, assurance level 2 enforced in `proxy.ts` and again in `requireAdmin`). A staff member without a factor is sent to enrol before reaching any admin page.
3. **The audit log is append-only and written twice.** Application code records who did what (`audit_log(actor, action, entity, before, after, reason, ip, user_agent)`) through one helper that every admin route calls; database triggers also record status changes on the sensitive tables (providers, payouts, staff, settings) so a direct database change is visible too. Updates and deletes on the log are rejected by trigger. Money-affecting actions require a written reason.
4. **Limits and four-eyes for big money.** Refunds or dispute decisions above a per-role limit need a second staff member with a finance or super_admin role to approve (`approvals` table). Manual payout release and fee changes always need approval.
5. **Reports never add currencies.** Every financial view groups by currency. A separate `fx_rates(date, base, quote, rate, source)` table, filled by hand or import, supports an optional "approximate total in USD" line, always labelled as an indicative conversion. Nothing in the ledger, payouts or receipts ever uses it. The current dashboard views that sum mixed currencies are corrected as part of this.
6. **Ledger integrity is a first-class report.** A trial balance (debits equal credits per currency and in total), a reconciliation of successful payments and refunds against ledger transactions, and a payout reconciliation (paid payouts against the ledger) run on demand and daily; any difference raises an alert.
7. **Exports are streamed CSV,** permission-checked, audited, and limited by date range: bookings, payments, refunds, payouts, ledger entries, tax collected by country, providers, and the audit log itself.
8. **The catalogue is managed here.** Vehicle models (brand, category, images, specifications) with the translation tables from 9b; a queue of "please add this model" requests from providers.
9. **Settings with guardrails.** Commission, service fee, hold length, dispute windows and reminder timings move from code constants into a `platform_settings` extension with validation, history and approval.

## 3. Data model (`0015`)

- `platform_staff(user_id pk, role, created_by, created_at, disabled_at)`.
- `audit_log(id bigint identity, at, actor_user_id, actor_role, action, entity_type, entity_id, before jsonb, after jsonb, reason, ip, user_agent, request_id)`, append-only by trigger, with indexes on entity and actor.
- `approvals(id, kind refund|dispute_decision|payout_release|fee_change, payload jsonb, amount_minor, currency, requested_by, requested_at, status pending|approved|rejected, decided_by, decided_at, note)`.
- `fx_rates`, `model_requests(id, provider_id, brand, name, notes, status, created_at)`, extended `platform_settings` with a `settings_history` table.
- Report views and functions (all per currency): `v_revenue_by_month_currency`, `v_gmv_take_rate`, `v_refunds_by_reason`, `v_payouts_by_provider`, `v_tax_collected_by_country`, `fn_trial_balance()`, `fn_reconcile_payments()`, `fn_reconcile_payouts()`.
- Functions and triggers: `audit(...)` helper for SQL callers; triggers on providers, payouts, staff and settings.

## 4. Screens and routes

Under `/admin` (English only): Overview (KPIs per currency, alerts), Providers (search, filters, notes, bulk approve of clean applications, suspend and reinstate), Cars (listing review), Customers (search, profile, bookings, flags, suspend), Bookings (all, force-cancel with reason, refund), Payments and refunds (list, retry a failed refund), Payouts (run, hold, release with approval, statements per provider), Disputes and Reports and Risk (queues with timers), Reviews (moderation), Licences (review queue, expiry), Catalogue, Promotions and tax rules, Settings and staff, Reports (with export buttons), Audit log (filters by actor, entity, action, date), Health (recent errors, cron status, reconciliation results).

APIs live under `/api/admin/*`, each guarded by one helper `requireStaff(permission)` that checks the claim, the role matrix and the second factor, and each writing to the audit log.

## 5. Testing and rollout

- Vitest: role permission matrix, approval thresholds and four-eyes rules, audit helper (always records, redacts secrets), CSV export escaping and streaming boundaries, currency grouping helpers, reconciliation comparison logic.
- SQL tests: the audit log rejects update and delete, triggers record sensitive changes, the trial balance is zero after a full booking, refund and payout cycle, reports never mix currencies (seed with two currencies and assert separate rows), approvals block execution until approved.
- Manual checklist: enrol a second factor, each role's access boundaries, approve a large refund with a second person, run and read every report, export and verify a CSV against the database, read the audit trail of everything done.
- Rollout: apply `0015`, promote existing admins to `super_admin` in the migration, deploy, require enrolment on next sign-in.
