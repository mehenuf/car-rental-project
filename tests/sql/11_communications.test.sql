create function test.mk(p_ref text, p_day text, p_email text, p_user uuid default null) returns uuid language sql as $$
  select (create_booking_atomic('11111111-1111-1111-1111-111111111111', 1, 1,
    (p_day || ' 10:00+00')::timestamptz, (p_day || ' 10:00+00')::timestamptz + interval '2 days',
    'Test Renter', p_email, 100, p_ref, null, null, 'web', null, p_user,
    jsonb_build_object('quote', jsonb_build_object('totalMinor', 10000, 'providerPayoutMinor', 8000, 'platformRevenueMinor', 2000,
      'currency', 'USD', 'pickupAt', '2033-01-01T00:00:00Z', 'cancellationTiers', '[]'::jsonb)))).id
$$;

insert into auth.users (id, email, email_confirmed_at) values
  ('cccccccc-0000-0000-0000-0000000000a1', 'renter@example.com', now()),
  ('cccccccc-0000-0000-0000-0000000000a2', 'owner@example.com', now()),
  ('cccccccc-0000-0000-0000-0000000000a3', 'stranger@example.com', now());

-- Events are written by triggers, in the same transaction as the change.
select test.mk('BC-N00001', '2034-01-10', 'renter@example.com', 'cccccccc-0000-0000-0000-0000000000a1');
select test.assert((select count(*) from outbox_events where aggregate_id = (select id from bookings where reference = 'BC-N00001')) = 0, 'creating a booking sends nothing yet');

update bookings set payment_status = 'paid' where reference = 'BC-N00001';
select test.assert((select count(*) from outbox_events where type = 'booking_confirmed' and aggregate_id = (select id from bookings where reference = 'BC-N00001')) = 1, 'payment enqueues booking_confirmed');
select test.assert((select count(*) from outbox_events where type = 'new_booking' and aggregate_id = (select id from bookings where reference = 'BC-N00001')) = 1, 'and tells the provider');
select test.assert((select payload ->> 'email' from outbox_events where type = 'booking_confirmed' and aggregate_id = (select id from bookings where reference = 'BC-N00001')) = 'renter@example.com', 'the event carries what the dispatcher needs');

-- Dedupe: a repeated fact creates one event.
select test.assert(enqueue_event('booking_confirmed', 'booking', (select id from bookings where reference = 'BC-N00001'), '{}'::jsonb, 'booking_confirmed:' || (select id from bookings where reference = 'BC-N00001')) is null, 'a duplicate dedupe key is ignored');

-- Atomic with the change: a rolled-back change leaves no event.
do $$
begin
  begin
    update bookings set status = 'cancelled' where reference = 'BC-N00001';
    raise exception 'force rollback';
  exception when raise_exception then
    null;
  end;
end $$;
select test.assert((select count(*) from outbox_events where type = 'booking_cancelled') = 0, 'a rolled-back cancellation leaves no event');
update bookings set status = 'cancelled' where reference = 'BC-N00001';
select test.assert((select count(*) from outbox_events where type = 'booking_cancelled') = 1, 'a committed cancellation enqueues one');
update bookings set payment_status = 'refunded' where reference = 'BC-N00001';
select test.assert((select count(*) from outbox_events where type = 'refund_issued') = 1, 'a refund enqueues refund_issued');

-- Claiming: two claimers never get the same row.
select test.assert((select count(*) from claim_pending_events(100)) >= 4, 'the first claimer receives the due events');
select test.assert((select count(*) from claim_pending_events(100)) = 0, 'a second claimer receives none (leased)');

insert into notifications (id, channel, template, address, dedupe_key) values
  ('a1000000-0000-0000-0000-000000000001', 'email', 'booking_confirmed', 'renter@example.com', 'k1');
select test.expect_error($$insert into notifications (channel, template, address, dedupe_key) values ('email', 'booking_confirmed', 'renter@example.com', 'k1')$$, '23505');
select test.assert((select count(*) from claim_due_notifications(10)) = 1, 'a due notification is claimed once');
select test.assert((select count(*) from claim_due_notifications(10)) = 0, 'and not again while leased');
select test.assert((select attempts from notifications where id = 'a1000000-0000-0000-0000-000000000001') = 1, 'claiming counts an attempt');

-- Reminders are idempotent.
select test.mk('BC-N00002', '2034-02-10', 'renter@example.com', 'cccccccc-0000-0000-0000-0000000000a1');
update bookings set payment_status = 'paid', status = 'confirmed' where reference = 'BC-N00002';
select test.assert(enqueue_due_reminders('2034-02-09 12:00+00') = 1, 'a booking starting within 24 hours gets a reminder');
select test.assert(enqueue_due_reminders('2034-02-09 12:00+00') = 0, 'and only one');
select test.assert(enqueue_due_reminders('2034-02-05 12:00+00') = 0, 'nothing is sent too early');

-- Contact channels: SMS consent needs a verified phone.
select test.expect_error($$insert into contact_channels (user_id, phone_e164, sms_opt_in) values ('cccccccc-0000-0000-0000-0000000000a1', '+15550001111', true)$$, '23514');
select test.expect_error($$insert into contact_channels (user_id, phone_e164) values ('cccccccc-0000-0000-0000-0000000000a1', '5550001111')$$, '23514');
insert into contact_channels (user_id, phone_e164, phone_verified_at, sms_opt_in) values ('cccccccc-0000-0000-0000-0000000000a1', '+15550001111', now(), true);

-- Suppressions are unique per channel and address.
insert into suppressions (channel, address, reason) values ('email', 'bounced@example.com', 'bounce');
select test.expect_error($$insert into suppressions (channel, address, reason) values ('email', 'bounced@example.com', 'complaint')$$, '23505');

-- Provider recipients are the owners and managers, with their emails.
insert into provider_members (provider_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000b0c1', 'cccccccc-0000-0000-0000-0000000000a2', 'owner');
select test.assert((select count(*) from provider_recipients('00000000-0000-0000-0000-00000000b0c1') where email = 'owner@example.com') = 1, 'the owner is a recipient');

-- Messages: one thread per booking, events for the other side, and access limited to the two parties.
insert into message_threads (id, booking_id, customer_user_id, provider_id) values
  ('a2000000-0000-0000-0000-000000000001', (select id from bookings where reference = 'BC-N00002'), 'cccccccc-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000b0c1');
select test.expect_error($$insert into message_threads (booking_id, provider_id) values ((select id from bookings where reference = 'BC-N00002'), '00000000-0000-0000-0000-00000000b0c1')$$, '23505');
select test.expect_error($$insert into messages (thread_id, sender_side, body) values ('a2000000-0000-0000-0000-000000000001', 'customer', '   ')$$, '23514');
insert into messages (id, thread_id, sender_side, sender_user_id, body) values
  ('a3000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'customer', 'cccccccc-0000-0000-0000-0000000000a1', 'What time can I collect?');
select test.assert((select payload ->> 'to' from outbox_events where type = 'new_message') = 'provider', 'a customer message notifies the provider');
insert into messages (thread_id, sender_side, body) values ('a2000000-0000-0000-0000-000000000001', 'platform', 'Notice from BestCar');
select test.assert((select count(*) from outbox_events where type = 'new_message') = 1, 'platform notices do not notify');

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select test.assert((select count(*) from message_threads) = 1, 'the customer sees their thread');
select test.assert((select count(*) from messages) = 2, 'and its messages');
select test.assert((select count(*) from notifications) = 0, 'but no notifications table');
select test.assert((select count(*) from outbox_events) = 0, 'or outbox');
reset role;

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000a2', true);
set local role authenticated;
select test.assert((select count(*) from message_threads) = 1, 'the provider owner sees the thread');
reset role;

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000a3', true);
set local role authenticated;
select test.assert((select count(*) from message_threads) = 0, 'a stranger sees no thread');
select test.assert((select count(*) from messages) = 0, 'and no messages');
reset role;

select test.assert(not has_function_privilege('authenticated', 'claim_due_notifications(integer)', 'execute'), 'signed-in users cannot claim notifications');
select test.assert(not has_function_privilege('anon', 'enqueue_event(text,text,uuid,jsonb,text,timestamptz,text)', 'execute'), 'anon cannot enqueue events');
select test.assert(not has_function_privilege('authenticated', 'provider_recipients(uuid)', 'execute'), 'signed-in users cannot list provider emails');
