create function test.snap(p_total bigint) returns jsonb language sql as $$
  select jsonb_build_object('quote', jsonb_build_object('totalMinor', p_total, 'providerPayoutMinor', p_total - 2000,
    'platformRevenueMinor', 2000, 'currency', 'USD', 'pickupAt', '2039-01-01T00:00:00Z', 'cancellationTiers', '[]'::jsonb))
$$;

insert into auth.users (id, email, email_confirmed_at) values
  ('cccccccc-0000-0000-0000-0000000000e1', 'ret.one@example.com', now()),
  ('cccccccc-0000-0000-0000-0000000000e2', 'ret.two@example.com', now());

-- ---------------------------------------------------------------
-- Licence documents
-- ---------------------------------------------------------------
insert into driver_documents (user_id, kind, storage_path, mime_type, size_bytes, created_at) values
  ('cccccccc-0000-0000-0000-0000000000e1', 'licence_front', 'e1/old.jpg', 'image/jpeg', 100, now() - interval '800 days'),
  ('cccccccc-0000-0000-0000-0000000000e1', 'licence_back', 'e1/new.jpg', 'image/jpeg', 100, now() - interval '10 days'),
  ('cccccccc-0000-0000-0000-0000000000e2', 'licence_front', 'e2/old.jpg', 'image/jpeg', 100, now() - interval '800 days');

select test.assert((select count(*) from expired_driver_documents()) = 2, 'old licence photos are listed for removal');
select test.assert(not exists (select 1 from expired_driver_documents() where storage_path = 'e1/new.jpg'), 'recent ones are not');

-- A person with an open booking keeps their documents.
select create_booking_atomic('11111111-1111-1111-1111-111111111111', 1, 1, '2039-03-10 10:00+00', '2039-03-11 10:00+00', 'Two', 'ret.two@example.com', 100, 'BC-R00002', '+15550002222', null, 'web', null, 'cccccccc-0000-0000-0000-0000000000e2', test.snap(10000));
select test.assert((select count(*) from expired_driver_documents()) = 1, 'documents of someone with an open booking are kept');
select test.assert((apply_retention() ->> 'driver_documents')::int = 1, 'retention deletes the listed rows');
select test.assert(exists (select 1 from driver_documents where storage_path = 'e2/old.jpg'), 'and only those');

-- ---------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------
select create_booking_atomic('11111111-1111-1111-1111-111111111111', 1, 1, '2039-04-10 10:00+00', '2039-04-11 10:00+00', 'One', 'ret.one@example.com', 100, 'BC-R00001', '+15550001111', null, 'web', null, 'cccccccc-0000-0000-0000-0000000000e1', test.snap(10000));
insert into message_threads (id, booking_id, customer_user_id, provider_id) values
  ('a2000000-0000-0000-0000-0000000000e1', (select id from bookings where reference = 'BC-R00001'), 'cccccccc-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000b0c1'),
  ('a2000000-0000-0000-0000-0000000000e2', (select id from bookings where reference = 'BC-R00002'), 'cccccccc-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000b0c1');
insert into messages (thread_id, sender_side, body, created_at) values
  ('a2000000-0000-0000-0000-0000000000e1', 'customer', 'old finished', now() - interval '1200 days'),
  ('a2000000-0000-0000-0000-0000000000e1', 'customer', 'recent finished', now() - interval '5 days'),
  ('a2000000-0000-0000-0000-0000000000e2', 'customer', 'old but booking open', now() - interval '1200 days');
update bookings set status = 'cancelled' where reference = 'BC-R00001';
select test.assert((apply_retention() ->> 'messages')::int = 1, 'only the old message of a finished booking is deleted');
select test.assert((select count(*) from messages where body in ('recent finished', 'old but booking open')) = 2, 'recent and open-booking messages stay');
select test.assert(exists (select 1 from bookings where reference = 'BC-R00001'), 'bookings themselves are untouched');

-- ---------------------------------------------------------------
-- Policy re-acceptance
-- ---------------------------------------------------------------
select test.assert((select count(*) from policies_to_accept('cccccccc-0000-0000-0000-0000000000e1')) = 2, 'a new person has terms and privacy to accept');
select test.assert((accept_policies('cccccccc-0000-0000-0000-0000000000e1')) = 2, 'accepting records both');
select test.assert((select count(*) from policies_to_accept('cccccccc-0000-0000-0000-0000000000e1')) = 0, 'and nothing is left');
select test.assert((accept_policies('cccccccc-0000-0000-0000-0000000000e1')) = 0, 'accepting twice does nothing');
insert into policy_versions (kind, version, published_at) values ('terms', '2027-01', now() + interval '1 second');
select test.assert((select version from policies_to_accept('cccccccc-0000-0000-0000-0000000000e1')) = '2027-01', 'a new terms version must be accepted again');
select test.assert((select count(*) from policies_to_accept('cccccccc-0000-0000-0000-0000000000e1') where kind = 'privacy') = 0, 'but unchanged privacy is not asked again');
insert into policy_versions (kind, version) values ('cookies', '2027-01');
select test.assert(not exists (select 1 from policies_to_accept('cccccccc-0000-0000-0000-0000000000e1') where kind = 'cookies'), 'cookie-policy changes do not block anyone');

select test.assert(not has_function_privilege('authenticated', 'accept_policies(uuid)', 'execute'), 'signed-in users cannot accept on behalf of others');
select test.assert(not has_function_privilege('anon', 'expired_driver_documents(timestamptz)', 'execute'), 'nor list documents');
