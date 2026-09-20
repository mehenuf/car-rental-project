create function test.snap(p_total bigint) returns jsonb language sql as $$
  select jsonb_build_object('quote', jsonb_build_object(
    'totalMinor', p_total, 'serviceFeeMinor', 500, 'commissionMinor', 1500,
    'providerPayoutMinor', p_total - 2000, 'platformRevenueMinor', 2000,
    'currency', 'USD', 'pickupAt', '2033-01-01T00:00:00Z', 'cancellationTiers', '[]'::jsonb))
$$;

-- A completed, paid booking with a deposit, for a signed-in renter.
create function test.completed(p_ref text, p_day text, p_user uuid, p_total bigint default 10000) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  v_id := (create_booking_atomic('11111111-1111-1111-1111-111111111111', 1, 1,
    (p_day || ' 10:00+00')::timestamptz, (p_day || ' 10:00+00')::timestamptz + interval '2 days',
    'Renter', 'renter@example.com', 100, p_ref, null, null, 'web', null, p_user, test.snap(p_total))).id;
  insert into payments (booking_id, kind, method, provider, status, amount_minor, currency, idempotency_key)
    values (v_id, 'charge', 'card', 'simulated', 'processing', p_total, 'USD', 'chg-' || p_ref);
  perform record_payment_success((select id from payments where idempotency_key = 'chg-' || p_ref));
  insert into payments (booking_id, kind, method, provider, status, amount_minor, currency, idempotency_key)
    values (v_id, 'deposit_hold', 'card', 'simulated', 'processing', 20000, 'USD', 'dep-' || p_ref);
  perform record_deposit_hold((select id from payments where idempotency_key = 'dep-' || p_ref));
  perform transition_booking(v_id, 'active');
  perform transition_booking(v_id, 'completed');
  return v_id;
end $$;

-- An open booking (pending, unpaid) and a helper to price it.
create function test.mk_booking_open(p_ref text, p_day text, p_total bigint default 10000) returns uuid language sql as $$
  select (create_booking_atomic('11111111-1111-1111-1111-111111111111', 1, 1,
    (p_day || ' 10:00+00')::timestamptz, (p_day || ' 10:00+00')::timestamptz + interval '1 day',
    'Test', 'open@example.com', p_total::numeric / 100, p_ref, null, null, 'web', null, null, test.snap(p_total))).id
$$;

insert into auth.users (id, email, email_confirmed_at) values
  ('cccccccc-0000-0000-0000-0000000000b1', 'renter@example.com', now()),
  ('cccccccc-0000-0000-0000-0000000000b2', 'owner@example.com', now()),
  ('cccccccc-0000-0000-0000-0000000000b3', 'stranger@example.com', now()),
  ('cccccccc-0000-0000-0000-0000000000b4', 'admin@example.com', now());
insert into provider_members (provider_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000b0c1', 'cccccccc-0000-0000-0000-0000000000b2', 'owner');

-- ---------------------------------------------------------------
-- Follow-ups: licence expiry, licence events, return reminders
-- ---------------------------------------------------------------
insert into driver_profiles (user_id, date_of_birth, licence_country, licence_number_last4, licence_expiry, status) values
  ('cccccccc-0000-0000-0000-0000000000b1', '1990-01-01', 'US', 'AB12', '2020-01-01', 'verified');
select test.assert(expire_licences('2026-09-20') = 1, 'a verified licence past its expiry is expired');
select test.assert((select status from driver_profiles where user_id = 'cccccccc-0000-0000-0000-0000000000b1') = 'expired', 'and its status changes');
select test.assert((select count(*) from outbox_events where type = 'licence_expired' and aggregate_id = 'cccccccc-0000-0000-0000-0000000000b1') = 1, 'the renter is told');
select test.assert(expire_licences('2026-09-20') = 0, 'expiring twice does nothing');
update driver_profiles set status = 'pending', licence_expiry = '2040-01-01' where user_id = 'cccccccc-0000-0000-0000-0000000000b1';
update driver_profiles set status = 'rejected', review_note = 'Blurry photo' where user_id = 'cccccccc-0000-0000-0000-0000000000b1';
select test.assert((select payload ->> 'note' from outbox_events where type = 'licence_rejected') = 'Blurry photo', 'a rejection carries the reason');
update driver_profiles set status = 'pending' where user_id = 'cccccccc-0000-0000-0000-0000000000b1';
update driver_profiles set status = 'verified' where user_id = 'cccccccc-0000-0000-0000-0000000000b1';
select test.assert((select count(*) from outbox_events where type = 'licence_verified') = 1, 'an approval is announced');

-- ---------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------
select test.completed('BC-V00001', '2035-01-10', 'cccccccc-0000-0000-0000-0000000000b1');
select test.completed('BC-V00002', '2035-02-10', 'cccccccc-0000-0000-0000-0000000000b1');

-- Bayesian average: (3 * 4.0 + sum) / (3 + n).
select test.assert(bayes_rating(0, 0) = 4.00, 'no reviews is the prior');
select test.assert(bayes_rating(5, 1) = 4.25, 'one five-star review moves it only a little');
select test.assert(bayes_rating(50, 10) = 4.77, 'ten five-star reviews move it a lot');

-- Only completed bookings, only the right people, only once.
select test.mk_booking_open('BC-V00009', '2035-03-10');
select test.expect_error($$select submit_review((select id from bookings where reference = 'BC-V00009'), 'customer_to_provider', 'cccccccc-0000-0000-0000-0000000000b1', 5, '{}', 'x')$$, 'BR001');
select test.expect_error($$select submit_review((select id from bookings where reference = 'BC-V00001'), 'customer_to_provider', 'cccccccc-0000-0000-0000-0000000000b3', 5, '{}', 'x')$$, 'BR003');
select test.expect_error($$select submit_review((select id from bookings where reference = 'BC-V00001'), 'provider_to_customer', 'cccccccc-0000-0000-0000-0000000000b3', 5, '{}', 'x')$$, 'BR003');
select test.expect_error($$select submit_review((select id from bookings where reference = 'BC-V00001'), 'customer_to_provider', 'cccccccc-0000-0000-0000-0000000000b1', 6, '{}', 'x')$$, '23514');

-- Double-blind: hidden until both sides have reviewed.
select test.assert((submit_review((select id from bookings where reference = 'BC-V00001'), 'customer_to_provider', 'cccccccc-0000-0000-0000-0000000000b1', 5, '{"cleanliness": 5}', 'Great car')).status = 'hidden', 'the first review stays hidden');
select test.expect_error($$select submit_review((select id from bookings where reference = 'BC-V00001'), 'customer_to_provider', 'cccccccc-0000-0000-0000-0000000000b1', 4, '{}', 'again')$$, '23505');
select test.assert((select rating_sum from provider_ratings where provider_id = '00000000-0000-0000-0000-00000000b0c1') is null, 'a hidden review does not count');

-- Editable while hidden.
select test.assert((edit_review((select id from reviews where comment = 'Great car'), 'cccccccc-0000-0000-0000-0000000000b1', 4, null, 'Great car, small scratch')).overall = 4, 'the author can edit a hidden review');
select test.expect_error($$select edit_review((select id from reviews where comment like 'Great car%'), 'cccccccc-0000-0000-0000-0000000000b3', 4, null, 'x')$$, 'BR003');

-- The provider's review reveals both together.
select test.assert((submit_review((select id from bookings where reference = 'BC-V00001'), 'provider_to_customer', 'cccccccc-0000-0000-0000-0000000000b2', 5, '{"care": 5}', 'Lovely renter')).status = 'published', 'the second review publishes both');
select test.assert((select count(*) from reviews where booking_id = (select id from bookings where reference = 'BC-V00001') and status = 'published') = 2, 'both are published');
select test.expect_error($$select edit_review((select id from reviews where comment like 'Great car%'), 'cccccccc-0000-0000-0000-0000000000b1', 5, null, 'x')$$, 'BR005');
select test.assert((select review_count = 1 and rating_sum = 4 and bayes_score = 4.00 from provider_ratings where provider_id = '00000000-0000-0000-0000-00000000b0c1'), 'the provider aggregate uses the published customer review only');
select test.assert((select review_count = 1 and rating = 4.00 from vehicles where id = '11111111-1111-1111-1111-111111111111'), 'the vehicle rating is derived from published reviews');

-- Reply once.
select test.assert((reply_to_review((select id from reviews where comment like 'Great car%'), 'cccccccc-0000-0000-0000-0000000000b2', 'Thank you!')).body = 'Thank you!', 'a provider replies');
select test.expect_error($$select reply_to_review((select id from reviews where comment like 'Great car%'), 'cccccccc-0000-0000-0000-0000000000b2', 'Again')$$, '23505');
select test.expect_error($$select reply_to_review((select id from reviews where comment = 'Lovely renter'), 'cccccccc-0000-0000-0000-0000000000b2', 'x')$$, 'BR006');
select test.expect_error($$select reply_to_review((select id from reviews where comment like 'Great car%'), 'cccccccc-0000-0000-0000-0000000000b3', 'x')$$, 'BR003');

-- Window end reveals a lone review; removal needs a reason and leaves the aggregate.
select submit_review((select id from bookings where reference = 'BC-V00002'), 'customer_to_provider', 'cccccccc-0000-0000-0000-0000000000b1', 2, '{}', 'Not great');
select test.assert(publish_due_reviews(now()) = 0, 'not yet due');
select test.assert(publish_due_reviews(now() + interval '15 days') = 1, 'a lone review appears when the window ends');
select test.assert((select review_count = 2 from provider_ratings where provider_id = '00000000-0000-0000-0000-00000000b0c1'), 'and counts');
select test.expect_error($$select remove_review((select id from reviews where comment = 'Not great'), '  ')$$, 'BR007');
select remove_review((select id from reviews where comment = 'Not great'), 'Abusive language');
select test.assert((select review_count = 1 from provider_ratings where provider_id = '00000000-0000-0000-0000-00000000b0c1'), 'a removed review no longer counts');

-- ---------------------------------------------------------------
-- Disputes
-- ---------------------------------------------------------------
select test.completed('BC-D00001', '2036-01-10', 'cccccccc-0000-0000-0000-0000000000b1');
select test.assert((select status = 'pending' from payouts where booking_id = (select id from bookings where reference = 'BC-D00001')), 'the payout starts pending');

select test.expect_error($$select open_dispute((select id from bookings where reference = 'BC-D00001'), 'provider', 'cccccccc-0000-0000-0000-0000000000b3', 'damage', 5000, 'Dent', '{}')$$, 'BD002');
select test.expect_error($$select open_dispute((select id from bookings where reference = 'BC-D00001'), 'provider', 'cccccccc-0000-0000-0000-0000000000b2', 'overcharge', 5000, 'x', '{}')$$, 'BD003');
select test.expect_error($$select open_dispute((select id from bookings where reference = 'BC-D00001'), 'provider', 'cccccccc-0000-0000-0000-0000000000b2', 'damage', 20001, 'x', '{}')$$, 'BD004');
select test.expect_error($$select open_dispute((select id from bookings where reference = 'BC-D00001'), 'provider', 'cccccccc-0000-0000-0000-0000000000b2', 'damage', null, 'x', '{}')$$, 'BD004');

select test.assert((open_dispute((select id from bookings where reference = 'BC-D00001'), 'provider', 'cccccccc-0000-0000-0000-0000000000b2', 'damage', 6000, 'Dent in the door', array['p/1.jpg'])).status = 'awaiting_response', 'a provider opens a damage dispute');
select test.assert((select status = 'frozen' from payouts where booking_id = (select id from bookings where reference = 'BC-D00001')), 'the payout is frozen');
select run_payouts(now() + interval '100 hours');
select test.assert((select status = 'frozen' from payouts where booking_id = (select id from bookings where reference = 'BC-D00001')), 'and is not paid while frozen');
select test.assert(booking_has_open_dispute((select id from bookings where reference = 'BC-D00001')), 'the booking has an open dispute');
select test.expect_error($$select open_dispute((select id from bookings where reference = 'BC-D00001'), 'provider', 'cccccccc-0000-0000-0000-0000000000b2', 'cleanliness_or_fees', 100, 'x', '{}')$$, '23505');

-- The opener cannot answer their own offer; the renter counters, the provider accepts.
select test.expect_error($$select respond_dispute((select id from disputes limit 1), 'provider', 'cccccccc-0000-0000-0000-0000000000b2', 'accept')$$, 'BD006');
select test.expect_error($$select respond_dispute((select id from disputes limit 1), 'customer', 'cccccccc-0000-0000-0000-0000000000b3', 'contest', 'x')$$, 'BD002');
select respond_dispute((select id from disputes limit 1), 'customer', 'cccccccc-0000-0000-0000-0000000000b1', 'message', 'It was already there', null, array['c/1.jpg']);
select test.expect_error($$select respond_dispute((select id from disputes limit 1), 'customer', 'cccccccc-0000-0000-0000-0000000000b1', 'counter', 'too much', 7000)$$, 'BD004');
select test.assert((respond_dispute((select id from disputes limit 1), 'customer', 'cccccccc-0000-0000-0000-0000000000b1', 'counter', 'I will pay half', 3000)).status = 'negotiating', 'a counter offer starts negotiating');
select test.assert((respond_dispute((select id from disputes limit 1), 'provider', 'cccccccc-0000-0000-0000-0000000000b2', 'accept')).status = 'agreed', 'accepting the offer agrees the amount');
select test.assert((select agreed_amount_minor = 3000 from disputes limit 1), 'at the offered amount');

-- Resolving by capture: the ledger stays balanced, the payout grows by the capture and is released.
select resolve_dispute((select id from disputes limit 1), 'capture', 3000, 'cccccccc-0000-0000-0000-0000000000b4', 'platform', 'Agreed');
select test.assert((select status = 'resolved' and resolution = 'capture' from disputes limit 1), 'the dispute is resolved');
select test.assert((select status = 'captured' and captured_minor = 3000 from payments where idempotency_key = 'dep-BC-D00001'), 'the deposit was captured for the agreed amount');
select test.assert((select status = 'pending' and amount_minor = 8000 + 3000 from payouts where booking_id = (select id from bookings where reference = 'BC-D00001')), 'the payout includes the capture and is unfrozen');
select test.assert(not booking_has_open_dispute((select id from bookings where reference = 'BC-D00001')), 'no dispute is open any more');
select test.assert((select coalesce(sum(case when direction = 'debit' then amount_minor else -amount_minor end), 0) from ledger_entries e join ledger_transactions t on t.id = e.transaction_id where t.booking_id = (select id from bookings where reference = 'BC-D00001')) = 0, 'the booking ledger balances');
select test.expect_error($$select resolve_dispute((select id from disputes limit 1), 'dismiss', null, 'cccccccc-0000-0000-0000-0000000000b4', 'platform')$$, 'BD005');

-- A renter's complaint, decided as a refund: the payout shrinks by the provider's share.
select test.completed('BC-D00002', '2036-02-10', 'cccccccc-0000-0000-0000-0000000000b1');
select open_dispute((select id from bookings where reference = 'BC-D00002'), 'customer', 'cccccccc-0000-0000-0000-0000000000b1', 'overcharge', 4000, 'Charged too much', '{}');
select test.assert((select status = 'frozen' from payouts where booking_id = (select id from bookings where reference = 'BC-D00002')), 'the renter''s dispute also freezes the payout');
select test.assert((respond_dispute((select id from disputes where opened_by_side = 'customer'), 'provider', 'cccccccc-0000-0000-0000-0000000000b2', 'contest', 'Price was as quoted')).status = 'escalated', 'contesting escalates to a reviewer');
select test.expect_error($$select resolve_dispute((select id from disputes where opened_by_side = 'customer'), 'refund', 4000, 'cccccccc-0000-0000-0000-0000000000b4', 'platform', 'x', null)$$, 'BD004');
insert into payments (booking_id, kind, method, provider, status, amount_minor, currency, idempotency_key) values
  ((select id from bookings where reference = 'BC-D00002'), 'refund', 'card', 'simulated', 'processing', 4000, 'USD', 'ref-BC-D00002');
select record_refund_success((select id from payments where idempotency_key = 'ref-BC-D00002'));
select resolve_dispute((select id from disputes where opened_by_side = 'customer'), 'refund', 4000, 'cccccccc-0000-0000-0000-0000000000b4', 'platform', 'Refund granted', (select id from payments where idempotency_key = 'ref-BC-D00002'));
select test.assert((select status = 'pending' and amount_minor = 8000 - 3200 from payouts where booking_id = (select id from bookings where reference = 'BC-D00002')), 'the payout is reduced by the provider share of the refund (80%)');

-- Dismissal, and automatic escalation after the deadline.
select test.completed('BC-D00003', '2036-03-10', 'cccccccc-0000-0000-0000-0000000000b1');
select open_dispute((select id from bookings where reference = 'BC-D00003'), 'provider', 'cccccccc-0000-0000-0000-0000000000b2', 'cleanliness_or_fees', 500, 'Dirty', '{}');
select test.assert(expire_disputes(now()) = 0, 'a fresh dispute is not escalated');
select test.assert(expire_disputes(now() + interval '73 hours') = 1, 'an unanswered dispute escalates after 72 hours');
select test.assert((select count(*) from dispute_events where actor_side = 'platform' and kind = 'escalate') = 1, 'and says so on the timeline');
select resolve_dispute((select id from disputes where booking_id = (select id from bookings where reference = 'BC-D00003')), 'dismiss', null, 'cccccccc-0000-0000-0000-0000000000b4', 'platform', 'No evidence');
select test.assert((select status = 'dismissed' from disputes where booking_id = (select id from bookings where reference = 'BC-D00003')), 'a dismissed dispute is closed');
select test.assert((select status = 'pending' and amount_minor = 8000 from payouts where booking_id = (select id from bookings where reference = 'BC-D00003')), 'and the payout is released in full');

-- Disputes cannot open after the window.
select test.completed('BC-D00004', '2036-04-10', 'cccccccc-0000-0000-0000-0000000000b1');
update bookings set completed_at = now() - interval '49 hours' where reference = 'BC-D00004';
select test.expect_error($$select open_dispute((select id from bookings where reference = 'BC-D00004'), 'provider', 'cccccccc-0000-0000-0000-0000000000b2', 'damage', 100, 'Late', '{}')$$, 'BD001');

-- ---------------------------------------------------------------
-- Trust and safety
-- ---------------------------------------------------------------
select test.mk_booking_open('BC-S00001', '2037-01-10', 600000);
update bookings set payment_status = 'paid', status = 'confirmed' where reference = 'BC-S00001';
select test.assert((select risk_status = 'held' and 'very_high_value' = any (risk_flags) from bookings where reference = 'BC-S00001'), 'a very high value booking is held for review');
select test.expect_error($$select record_inspection((select id from bookings where reference = 'BC-S00001'), 'pickup', 1, 'full', null, '{}', null, 'checked')$$, 'BP011');
update bookings set risk_status = 'cleared' where reference = 'BC-S00001';
select test.assert((record_inspection((select id from bookings where reference = 'BC-S00001'), 'pickup', 1, 'full', null, '{}', null, 'checked')).status = 'active', 'a cleared booking can be handed over');

select test.mk_booking_open('BC-S00002', '2037-02-10', 100);
update bookings set payment_status = 'paid', status = 'confirmed' where reference = 'BC-S00002';
select test.assert((select risk_status = 'clear' and cardinality(risk_flags) = 0 from bookings where reference = 'BC-S00002'), 'an ordinary booking is not flagged');

insert into user_flags (user_id, suspended, reason) values ('cccccccc-0000-0000-0000-0000000000b3', true, 'Fraud');
select test.expect_error($$select create_booking_atomic('11111111-1111-1111-1111-111111111111', 1, 1, '2037-03-10 10:00+00', '2037-03-11 10:00+00', 'X', 'x@example.com', 100, 'BC-S00003', null, null, 'web', null, 'cccccccc-0000-0000-0000-0000000000b3', null)$$, 'BS002');

insert into reports (kind, target_id, reporter_user_id, reason) values ('listing', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-0000000000b1', 'Photos are not of this car');
select test.expect_error($$insert into reports (kind, target_id, reason) values ('listing', '11111111-1111-1111-1111-111111111111', '  ')$$, '23514');

-- ---------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000b3', true);
set local role authenticated;
select test.assert((select count(*) from reviews) = 2, 'a stranger reads only the published reviews');
select test.assert((select count(*) from disputes) = 0, 'and no disputes');
select test.assert((select count(*) from dispute_events) = 0, 'or evidence');
select test.assert((select count(*) from reports) = 0, 'or reports');
select test.assert((select count(*) from provider_ratings) = 1, 'ratings are public');
reset role;

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000b1', true);
set local role authenticated;
select test.assert((select count(*) from disputes) >= 3, 'the renter sees their disputes');
reset role;
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000b2', true);
set local role authenticated;
select test.assert((select count(*) from disputes) >= 3, 'the provider sees theirs');
reset role;

select test.assert(not has_function_privilege('authenticated', 'resolve_dispute(uuid,text,bigint,uuid,text,text,uuid)', 'execute'), 'signed-in users cannot resolve disputes');
select test.assert(not has_function_privilege('anon', 'submit_review(uuid,text,uuid,integer,jsonb,text)', 'execute'), 'anon cannot submit reviews');
