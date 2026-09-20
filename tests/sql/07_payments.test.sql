-- Helpers (created inside this test's transaction, rolled back afterwards).
create function test.snap(p_total bigint, p_service bigint, p_commission bigint) returns jsonb language sql as $$
  select jsonb_build_object('quote', jsonb_build_object(
    'totalMinor', p_total, 'serviceFeeMinor', p_service, 'commissionMinor', p_commission,
    'providerPayoutMinor', p_total - p_service - p_commission,
    'platformRevenueMinor', p_service + p_commission,
    'currency', 'USD', 'pickupAt', '2031-01-01T00:00:00Z', 'cancellationTiers', '[]'::jsonb))
$$;

create function test.mk_booking(p_ref text, p_day text, p_total bigint default 10000) returns uuid language sql as $$
  select (create_booking_atomic('11111111-1111-1111-1111-111111111111', 1, 1,
    (p_day || ' 10:00+00')::timestamptz, (p_day || ' 10:00+00')::timestamptz + interval '1 day',
    'T', 't@example.com', 100, p_ref, null, null, 'web', null, null, test.snap(p_total, 500, 1500))).id
$$;

create function test.mk_payment(p_booking uuid, p_kind text, p_amount bigint, p_status text, p_key text) returns uuid language sql as $$
  insert into payments (booking_id, kind, method, provider, status, amount_minor, currency, idempotency_key)
  values (p_booking, p_kind, 'card', 'simulated', p_status, p_amount, 'USD', p_key) returning id
$$;

create function test.bal(p_booking uuid, p_code text, p_dir text) returns bigint language sql as $$
  select coalesce(sum(e.amount_minor), 0)::bigint from ledger_entries e
  join ledger_transactions t on t.id = e.transaction_id
  join ledger_accounts a on a.id = e.account_id
  where t.booking_id = p_booking and a.code = p_code and e.direction = p_dir
$$;

-- Payment methods widened.
update bookings set payment_method = 'bkash' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select test.expect_error($$update bookings set payment_method = 'cash' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, '23514');

-- Legacy confirmed/completed bookings count as paid; pending stays unpaid.
select test.assert((select payment_status from bookings where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'paid', 'legacy completed booking is paid');
select test.assert((select payment_status from bookings where id = 'aaaaaaaa-0000-0000-0000-000000000004') = 'unpaid', 'legacy pending booking is unpaid');

-- Ledger: accounts, idempotent posting, balance and append-only.
select test.assert(ledger_account('psp_cash', null, 'asset') = ledger_account('psp_cash', null, 'asset'), 'ledger_account is get-or-create');
select post_ledger(null, 'test', 'k1', 'memo', 'USD', '[{"account":"psp_cash","account_kind":"asset","direction":"debit","amount_minor":100},{"account":"platform_revenue","account_kind":"income","direction":"credit","amount_minor":100}]'::jsonb);
select test.assert((select count(*) from ledger_entries e join ledger_transactions t on t.id = e.transaction_id where t.idempotency_key = 'k1') = 2, 'a posted transaction has both entries');
select test.assert(
  post_ledger(null, 'test', 'k1', 'memo', 'USD', '[{"account":"psp_cash","account_kind":"asset","direction":"debit","amount_minor":999},{"account":"platform_revenue","account_kind":"income","direction":"credit","amount_minor":999}]'::jsonb)
  = (select id from ledger_transactions where idempotency_key = 'k1'), 'posting the same key again returns the same transaction');
select test.assert((select count(*) from ledger_entries e join ledger_transactions t on t.id = e.transaction_id where t.idempotency_key = 'k1') = 2, 'and adds nothing');
select test.expect_error($$select post_ledger(null, 'test', 'k2', 'bad', 'USD', '[{"account":"psp_cash","account_kind":"asset","direction":"debit","amount_minor":100},{"account":"platform_revenue","account_kind":"income","direction":"credit","amount_minor":90}]'::jsonb)$$, 'BC011');
select test.expect_error($$update ledger_entries set amount_minor = 1$$, 'BC010');
select test.expect_error($$delete from ledger_entries$$, 'BC010');
select test.expect_error($$update ledger_transactions set memo = 'x'$$, 'BC010');
select test.expect_error($$delete from ledger_transactions$$, 'BC010');
-- The deferred constraint is a backstop against direct unbalanced inserts.
select test.expect_error($$
  insert into ledger_transactions (id, kind, idempotency_key) values ('f1000000-0000-0000-0000-000000000001', 'test', 'direct');
  insert into ledger_entries (transaction_id, account_id, direction, amount_minor, currency)
    values ('f1000000-0000-0000-0000-000000000001', ledger_account('psp_cash', null, 'asset'), 'debit', 50, 'USD');
  set constraints all immediate
$$, 'BC011');

-- Holds: a new booking is held for 15 minutes and unpaid.
select test.mk_booking('BC-P00001', '2031-02-01', 10000);
select test.assert((select payment_status from bookings where reference = 'BC-P00001') = 'unpaid', 'new booking is unpaid');
select test.assert((select hold_expires_at between now() + interval '14 minutes' and now() + interval '16 minutes' from bookings where reference = 'BC-P00001'), 'hold lasts 15 minutes');

update bookings set hold_expires_at = now() - interval '1 minute' where reference = 'BC-P00001';
select test.assert(expire_stale_holds() = 1, 'one stale hold expired');
select test.assert((select status from bookings where reference = 'BC-P00001') = 'cancelled', 'the expired booking is cancelled');
select test.assert(not exists (select 1 from unit_occupancy o join bookings b on b.id = o.booking_id where b.reference = 'BC-P00001'), 'its unit is freed');
select test.assert(expire_stale_holds() = 0, 'expiry is idempotent');
select test.assert((select status from bookings where id = 'aaaaaaaa-0000-0000-0000-000000000004') = 'pending', 'legacy pending bookings without a hold never expire');

-- Booking sweeps stale holds first: two units, both held and expired, a third booking still succeeds.
select test.mk_booking('BC-P00002', '2031-03-01');
select test.mk_booking('BC-P00003', '2031-03-01');
update bookings set hold_expires_at = now() - interval '1 minute' where reference in ('BC-P00002', 'BC-P00003');
select test.mk_booking('BC-P00004', '2031-03-01');
select test.assert((select status from bookings where reference = 'BC-P00004') = 'pending', 'booking after expired holds succeeds');

-- Payment success confirms the booking and posts a balanced ledger transaction.
select test.mk_booking('BC-P00010', '2031-04-01', 10000);
select test.mk_payment((select id from bookings where reference = 'BC-P00010'), 'charge', 10000, 'processing', 'pay-10');
select test.assert((record_payment_success((select id from payments where idempotency_key = 'pay-10')) ->> 'result') = 'confirmed', 'payment success confirms');
select test.assert((select status = 'confirmed' and payment_status = 'paid' and payment_method = 'card' and hold_expires_at is null from bookings where reference = 'BC-P00010'), 'booking is confirmed and paid');
select test.assert(test.bal((select id from bookings where reference = 'BC-P00010'), 'psp_cash', 'debit') = 10000, 'cash debited with the total');
select test.assert(test.bal((select id from bookings where reference = 'BC-P00010'), 'provider_payable', 'credit') = 8000, 'provider payable credited with the provider share');
select test.assert(test.bal((select id from bookings where reference = 'BC-P00010'), 'platform_revenue', 'credit') = 2000, 'platform revenue credited with commission and service fee');
select test.assert((record_payment_success((select id from payments where idempotency_key = 'pay-10')) ->> 'result') = 'already_recorded', 'recording twice is idempotent');
select test.assert(test.bal((select id from bookings where reference = 'BC-P00010'), 'psp_cash', 'debit') = 10000, 'and posts nothing twice');

-- Payment success rejects a wrong amount, a missing snapshot, and an unavailable booking.
select test.mk_booking('BC-P00011', '2031-04-05', 10000);
select test.mk_payment((select id from bookings where reference = 'BC-P00011'), 'charge', 9999, 'processing', 'pay-11');
select test.expect_error($$select record_payment_success((select id from payments where idempotency_key = 'pay-11'))$$, 'BP003');
select test.mk_payment('aaaaaaaa-0000-0000-0000-000000000004', 'charge', 100, 'processing', 'pay-legacy');
select test.expect_error($$select record_payment_success((select id from payments where idempotency_key = 'pay-legacy'))$$, 'BP003');
select test.mk_booking('BC-P00012', '2031-04-09', 10000);
select transition_booking((select id from bookings where reference = 'BC-P00012'), 'cancelled');
select test.mk_payment((select id from bookings where reference = 'BC-P00012'), 'charge', 10000, 'processing', 'pay-12');
select test.assert((record_payment_success((select id from payments where idempotency_key = 'pay-12')) ->> 'result') = 'booking_unavailable', 'a cancelled booking cannot be paid');
select test.assert((select status from payments where idempotency_key = 'pay-12') = 'failed', 'and the payment is marked failed');
select test.assert(test.bal((select id from bookings where reference = 'BC-P00012'), 'psp_cash', 'debit') = 0, 'with no ledger entries');

-- Refunds reverse the ledger in proportion and update the payment status.
select test.mk_payment((select id from bookings where reference = 'BC-P00010'), 'refund', 5000, 'processing', 'refund-10a');
select test.assert((record_refund_success((select id from payments where idempotency_key = 'refund-10a')) ->> 'result') = 'recorded', 'refund is recorded');
select test.assert((select provider_part_minor = 4000 and platform_part_minor = 1000 from payments where idempotency_key = 'refund-10a'), 'refund is split 80/20 like the sale');
select test.assert(test.bal((select id from bookings where reference = 'BC-P00010'), 'provider_payable', 'debit') = 4000, 'provider payable reduced');
select test.assert(test.bal((select id from bookings where reference = 'BC-P00010'), 'platform_revenue', 'debit') = 1000, 'platform revenue reduced');
select test.assert(test.bal((select id from bookings where reference = 'BC-P00010'), 'psp_cash', 'credit') = 5000, 'cash credited with the refund');
select test.assert((select payment_status from bookings where reference = 'BC-P00010') = 'partially_refunded', 'booking is partially refunded');
select test.assert((record_refund_success((select id from payments where idempotency_key = 'refund-10a')) ->> 'result') = 'already_recorded', 'refund recording is idempotent');

-- Payout: created on completion, reduced by the refund, paid after the dispute window.
select transition_booking((select id from bookings where reference = 'BC-P00010'), 'active');
select transition_booking((select id from bookings where reference = 'BC-P00010'), 'completed');
select test.assert((select amount_minor = 4000 and status = 'pending' from payouts where booking_id = (select id from bookings where reference = 'BC-P00010')), 'payout is the provider share less the refund');
select test.assert((select release_after = b.completed_at + interval '48 hours' from payouts p join bookings b on b.id = p.booking_id where b.reference = 'BC-P00010'), 'payout is released after 48 hours');
select test.assert(run_payouts(now()) = 0, 'nothing is due yet');
select test.assert(run_payouts(now() + interval '49 hours') = 1, 'the payout is paid once due');
select test.assert((select status = 'paid' from payouts where booking_id = (select id from bookings where reference = 'BC-P00010')), 'payout status is paid');
select test.assert(test.bal((select id from bookings where reference = 'BC-P00010'), 'provider_paid_out', 'credit') = 4000, 'payout is posted to the ledger');
select test.assert(run_payouts(now() + interval '49 hours') = 0, 'paying twice is impossible');

-- Full refund flips to refunded, and over-refunding is rejected.
select test.mk_payment((select id from bookings where reference = 'BC-P00010'), 'refund', 5000, 'processing', 'refund-10b');
select record_refund_success((select id from payments where idempotency_key = 'refund-10b'));
select test.assert((select payment_status from bookings where reference = 'BC-P00010') = 'refunded', 'fully refunded');
select test.mk_payment((select id from bookings where reference = 'BC-P00010'), 'refund', 1, 'processing', 'refund-10c');
select test.expect_error($$select record_refund_success((select id from payments where idempotency_key = 'refund-10c'))$$, 'BP004');

-- A frozen payout is never paid; an unpaid booking creates none.
select test.mk_booking('BC-P00020', '2031-05-01', 10000);
select test.mk_payment((select id from bookings where reference = 'BC-P00020'), 'charge', 10000, 'processing', 'pay-20');
select record_payment_success((select id from payments where idempotency_key = 'pay-20'));
select transition_booking((select id from bookings where reference = 'BC-P00020'), 'active');
select transition_booking((select id from bookings where reference = 'BC-P00020'), 'completed');
update payouts set status = 'frozen' where booking_id = (select id from bookings where reference = 'BC-P00020');
select test.assert(run_payouts(now() + interval '100 hours') = 0, 'frozen payouts are skipped');
select test.assert(not exists (select 1 from payouts where booking_id = 'aaaaaaaa-0000-0000-0000-000000000004'), 'unpaid bookings create no payout');

-- Deposits: hold, release, capture.
select test.mk_booking('BC-P00030', '2031-06-01', 10000);
select test.mk_payment((select id from bookings where reference = 'BC-P00030'), 'deposit_hold', 20000, 'processing', 'dep-30a');
select test.assert((record_deposit_hold((select id from payments where idempotency_key = 'dep-30a')) ->> 'result') = 'recorded', 'deposit hold recorded');
select test.assert((record_deposit_hold((select id from payments where idempotency_key = 'dep-30a')) ->> 'result') = 'already_recorded', 'idempotent');
select test.assert(test.bal((select id from bookings where reference = 'BC-P00030'), 'psp_cash', 'debit') = 0, 'a held deposit posts nothing');
select test.assert((release_deposit((select id from payments where idempotency_key = 'dep-30a')) ->> 'result') = 'released', 'deposit released');
select test.assert((select status from payments where idempotency_key = 'dep-30a') = 'released', 'status is released');
select test.expect_error($$select capture_deposit((select id from payments where idempotency_key = 'dep-30a'), 100)$$, 'BP005');

select test.mk_payment((select id from bookings where reference = 'BC-P00030'), 'deposit_hold', 20000, 'processing', 'dep-30b');
select record_deposit_hold((select id from payments where idempotency_key = 'dep-30b'));
select test.expect_error($$select capture_deposit((select id from payments where idempotency_key = 'dep-30b'), 20001)$$, 'BP004');
select capture_deposit((select id from payments where idempotency_key = 'dep-30b'), 3000);
select test.assert((select status = 'captured' and captured_minor = 3000 from payments where idempotency_key = 'dep-30b'), 'partial capture recorded');
select test.assert(test.bal((select id from bookings where reference = 'BC-P00030'), 'psp_cash', 'debit') = 3000, 'capture debits cash');
select test.assert(test.bal((select id from bookings where reference = 'BC-P00030'), 'provider_payable', 'credit') = 3000, 'and credits the provider');

-- Access: provider owners and managers read their payouts; nobody but the server reads money tables.
insert into auth.users (id) values ('cccccccc-0000-0000-0000-0000000000c1'), ('cccccccc-0000-0000-0000-0000000000c2');
insert into provider_members (provider_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000b0c1', 'cccccccc-0000-0000-0000-0000000000c1', 'manager');

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000c1', true);
set local role authenticated;
select test.assert((select count(*) from payouts) >= 2, 'manager reads the provider payouts');
select test.assert((select count(*) from payments) = 0, 'payments are server-only');
select test.assert((select count(*) from ledger_entries) = 0, 'the ledger is server-only');
reset role;

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000c2', true);
set local role authenticated;
select test.assert((select count(*) from payouts) = 0, 'a stranger sees no payouts');
reset role;
