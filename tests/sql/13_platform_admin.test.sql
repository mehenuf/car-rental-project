insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data) values
  ('cccccccc-0000-0000-0000-0000000000c1', 'super@example.com', now(), '{"role": "admin"}'),
  ('cccccccc-0000-0000-0000-0000000000c2', 'finance@example.com', now(), null),
  ('cccccccc-0000-0000-0000-0000000000c3', 'support@example.com', now(), null),
  ('cccccccc-0000-0000-0000-0000000000c4', 'nobody@example.com', now(), null);

-- ---------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------
insert into platform_staff (user_id, role) values
  ('cccccccc-0000-0000-0000-0000000000c1', 'super_admin'),
  ('cccccccc-0000-0000-0000-0000000000c2', 'finance'),
  ('cccccccc-0000-0000-0000-0000000000c3', 'support');
select test.expect_error($$insert into platform_staff (user_id, role) values ('cccccccc-0000-0000-0000-0000000000c4', 'owner')$$, '23514');
select test.assert(staff_role('cccccccc-0000-0000-0000-0000000000c2') = 'finance', 'staff_role returns the role');
select test.assert(staff_role('cccccccc-0000-0000-0000-0000000000c4') is null, 'and null for a non-staff user');
update platform_staff set disabled_at = now() where user_id = 'cccccccc-0000-0000-0000-0000000000c3';
select test.assert(staff_role('cccccccc-0000-0000-0000-0000000000c3') is null, 'a disabled staff member has no role');
select test.assert((select count(*) from audit_log where entity_type = 'platform_staff') >= 4, 'staff changes are audited');

-- ---------------------------------------------------------------
-- Audit log is append-only
-- ---------------------------------------------------------------
select audit_write('test.action', 'thing', '42', '{"a": 1}'::jsonb, '{"a": 2}'::jsonb, 'because');
select test.assert((select actor_role from audit_log where action = 'test.action') = 'system', 'with no signed-in user the actor is the system');
select test.expect_error($$update audit_log set reason = 'x'$$, 'BA010');
select test.expect_error($$delete from audit_log$$, 'BA010');
select test.expect_error($$truncate audit_log$$, 'BA010');

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000c2', true);
select audit_write('test.by_finance', 'thing', '43', null, null);
select test.assert((select actor_role from audit_log where action = 'test.by_finance') = 'finance', 'a signed-in staff actor is recorded with their role');
select set_config('request.jwt.claim.sub', '', true);

-- Sensitive tables audit themselves.
update providers set status = 'suspended' where id = '00000000-0000-0000-0000-00000000b0c1';
select test.assert((select (before ->> 'status') is distinct from (after ->> 'status') from audit_log where action = 'providers.update' order by id desc limit 1), 'a provider status change is audited with before and after');
update providers set display_name = display_name where id = '00000000-0000-0000-0000-00000000b0c1';
update providers set status = 'approved' where id = '00000000-0000-0000-0000-00000000b0c1';

-- ---------------------------------------------------------------
-- Approvals: four-eyes, enforced by the database
-- ---------------------------------------------------------------
insert into approvals (id, kind, payload, requested_by) values
  ('a5000000-0000-0000-0000-000000000001', 'fee_change', '{"commission_bp": 1200}', 'cccccccc-0000-0000-0000-0000000000c3');
select test.expect_error($$select decide_approval('a5000000-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-0000000000c3', true)$$, 'BA012');
select test.expect_error($$select decide_approval('a5000000-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-0000000000c4', true)$$, 'BA012');

insert into approvals (id, kind, payload, requested_by) values
  ('a5000000-0000-0000-0000-000000000002', 'fee_change', '{"commission_bp": 1000}', 'cccccccc-0000-0000-0000-0000000000c2');
select test.expect_error($$select decide_approval('a5000000-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-0000000000c2', true)$$, '23514');

select test.assert((select commission_bp from platform_settings) = 1500, 'commission starts at the default');
select test.assert((decide_approval('a5000000-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-0000000000c2', true, 'ok')).status = 'executed', 'a second person approves a fee change and it executes');
select test.assert((select commission_bp from platform_settings) = 1200, 'the commission changed');
select test.assert((select count(*) from settings_history where approval_id = 'a5000000-0000-0000-0000-000000000001') = 1, 'with a history row linked to the approval');
select test.assert((select (before ->> 'commission_bp')::int = 1500 and (after ->> 'commission_bp')::int = 1200 from settings_history order by id desc limit 1), 'recording before and after');
select test.assert((select count(*) from audit_log where action = 'platform_settings.update') = 1, 'and the audit log');
select test.expect_error($$select decide_approval('a5000000-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-0000000000c1', true)$$, 'BA011');

select test.assert((decide_approval('a5000000-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-0000000000c1', false, 'no')).status = 'rejected', 'a rejected fee change changes nothing');
select test.assert((select commission_bp from platform_settings) = 1200, 'the commission is unchanged');

insert into approvals (id, kind, payload, amount_minor, currency, requested_by) values
  ('a5000000-0000-0000-0000-000000000003', 'refund', '{}', 50000, 'USD', 'cccccccc-0000-0000-0000-0000000000c3');
select test.assert((decide_approval('a5000000-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-0000000000c2', true)).status = 'approved', 'a refund approval only authorises it');
select mark_approval_executed('a5000000-0000-0000-0000-000000000003');
select test.assert((select status from approvals where id = 'a5000000-0000-0000-0000-000000000003') = 'executed', 'and is marked executed once done');

-- ---------------------------------------------------------------
-- Reports never mix currencies
-- ---------------------------------------------------------------
select post_ledger(null, 'test', 'rev-usd', 'usd sale', 'USD', '[{"account":"psp_cash","account_kind":"asset","direction":"debit","amount_minor":10000},{"account":"platform_revenue","account_kind":"income","direction":"credit","amount_minor":10000}]'::jsonb);
select post_ledger(null, 'test', 'rev-eur', 'eur sale', 'EUR', '[{"account":"psp_cash","account_kind":"asset","direction":"debit","amount_minor":7000},{"account":"platform_revenue","account_kind":"income","direction":"credit","amount_minor":7000}]'::jsonb);
select test.assert((select count(*) from v_revenue_by_month_currency) = 2, 'revenue has one row per currency');
select test.assert((select revenue_minor from v_revenue_by_month_currency where currency = 'USD') = 10000, 'USD revenue is 100.00');
select test.assert((select revenue_minor from v_revenue_by_month_currency where currency = 'EUR') = 7000, 'EUR revenue is separate');

select test.assert((select count(*) from fn_trial_balance()) = 2, 'the trial balance has one row per currency');
select test.assert((select bool_and(difference_minor = 0) from fn_trial_balance()), 'and every currency balances');

-- Reconciliation finds a difference between payments and the ledger cash account.
select test.assert((select difference_minor from fn_reconcile_payments() where currency = 'USD') = -10000, 'ledger cash with no matching payment shows as a difference');
insert into payments (booking_id, kind, method, provider, status, amount_minor, currency, idempotency_key)
  select id, 'charge', 'card', 'simulated', 'succeeded', 10000, 'USD', 'recon-usd' from bookings limit 1;
select test.assert((select difference_minor from fn_reconcile_payments() where currency = 'USD') = 0, 'a matching payment clears it');
select test.assert((select difference_minor from fn_reconcile_payments() where currency = 'EUR') = -7000, 'and the other currency still shows its own difference');

select test.assert((select count(*) from fn_reconcile_payouts()) = 0, 'no payouts have been paid yet');

-- Ledger and payouts reconcile after a real payout.
create function test.snap(p_total bigint) returns jsonb language sql as $$
  select jsonb_build_object('quote', jsonb_build_object('totalMinor', p_total, 'providerPayoutMinor', p_total - 2000,
    'platformRevenueMinor', 2000, 'currency', 'USD', 'pickupAt', '2038-01-01T00:00:00Z', 'cancellationTiers', '[]'::jsonb))
$$;
select create_booking_atomic('11111111-1111-1111-1111-111111111111', 1, 1, '2038-01-10 10:00+00', '2038-01-11 10:00+00', 'T', 't@example.com', 100, 'BC-A00001', null, null, 'web', null, null, test.snap(10000));
insert into payments (booking_id, kind, method, provider, status, amount_minor, currency, idempotency_key)
  values ((select id from bookings where reference = 'BC-A00001'), 'charge', 'card', 'simulated', 'processing', 10000, 'USD', 'a-chg');
select record_payment_success((select id from payments where idempotency_key = 'a-chg'));
select transition_booking((select id from bookings where reference = 'BC-A00001'), 'active');
select transition_booking((select id from bookings where reference = 'BC-A00001'), 'completed');
select run_payouts(now() + interval '100 hours');
select test.assert((select difference_minor from fn_reconcile_payouts() where currency = 'USD') = 0, 'paid payouts equal the ledger paid-out account');
select test.assert((select count(*) from audit_log where action = 'payouts.update') >= 1, 'a payout change is audited');
select test.assert((select amount_minor from v_payouts_by_provider where currency = 'USD' and status = 'paid') = 8000, 'the payout report is per currency and status');
select test.assert((select take_rate_bp from v_gmv_take_rate where currency = 'USD' order by month desc limit 1) is not null, 'the take-rate view works');

-- ---------------------------------------------------------------
-- Existing admins were promoted by the migration; access is server-only
-- ---------------------------------------------------------------
select test.assert(not has_function_privilege('authenticated', 'decide_approval(uuid,uuid,boolean,text)', 'execute'), 'signed-in users cannot decide approvals');
select test.assert(not has_function_privilege('anon', 'fn_trial_balance()', 'execute'), 'anon cannot run reconciliation');
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000c4', true);
set local role authenticated;
select test.assert((select count(*) from audit_log) = 0, 'a signed-in user cannot read the audit log');
select test.assert((select count(*) from approvals) = 0, 'or approvals');
select test.assert((select count(*) from platform_staff) = 0, 'or the staff list');
reset role;
