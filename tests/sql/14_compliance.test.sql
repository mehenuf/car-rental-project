create function test.snap(p_total bigint) returns jsonb language sql as $$
  select jsonb_build_object('quote', jsonb_build_object('totalMinor', p_total, 'providerPayoutMinor', p_total - 2000,
    'platformRevenueMinor', 2000, 'currency', 'USD', 'pickupAt', '2039-01-01T00:00:00Z', 'cancellationTiers', '[]'::jsonb))
$$;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('cccccccc-0000-0000-0000-0000000000d1', 'erase.me@example.com', now(), '{"full_name": "Erin Erase"}'),
  ('cccccccc-0000-0000-0000-0000000000d2', 'keep.me@example.com', now(), null);

-- ---------------------------------------------------------------
-- Rate limiter
-- ---------------------------------------------------------------
select test.assert((select allowed from rate_limit_hit('k1', 60, 3)), 'the first hit is allowed');
select rate_limit_hit('k1', 60, 3);
select test.assert((select allowed and remaining = 0 from rate_limit_hit('k1', 60, 3)), 'the third hit is the last allowed');
select test.assert((select not allowed and retry_after_seconds between 1 and 60 from rate_limit_hit('k1', 60, 3)), 'the fourth is refused with a retry time');
select test.assert((select allowed from rate_limit_hit('k2', 60, 3)), 'other keys are independent');
select test.assert((select hits from rate_limits where key = 'k1') = 4, 'the count is stored durably');

-- ---------------------------------------------------------------
-- Consent and policies
-- ---------------------------------------------------------------
select test.assert((select count(*) from policy_versions) = 3, 'the first policy versions are seeded');
insert into consents (user_id, purpose, granted, policy_version) values ('cccccccc-0000-0000-0000-0000000000d1', 'analytics', true, '2026-09');
insert into consents (anon_id, purpose, granted, policy_version) values ('anon-1', 'analytics', false, '2026-09');
select test.expect_error($$insert into consents (purpose, granted, policy_version) values ('analytics', true, '2026-09')$$, '23514');
select test.expect_error($$insert into consents (anon_id, purpose, granted, policy_version) values ('a', 'marketing', true, '2026-09')$$, '23514');
insert into policy_acceptances (user_id, kind, version) values ('cccccccc-0000-0000-0000-0000000000d1', 'terms', '2026-09');
select test.expect_error($$insert into policy_acceptances (user_id, kind, version) values ('cccccccc-0000-0000-0000-0000000000d1', 'terms', '1999-01')$$, '23503');

-- ---------------------------------------------------------------
-- A person's data, then erasure
-- ---------------------------------------------------------------
select create_booking_atomic('11111111-1111-1111-1111-111111111111', 1, 1, '2039-02-10 10:00+00', '2039-02-11 10:00+00', 'Erin Erase', 'erase.me@example.com', 100, 'BC-E00001', '+15550001111', null, 'web', null, 'cccccccc-0000-0000-0000-0000000000d1', test.snap(10000));
insert into driver_profiles (user_id, date_of_birth, licence_country, licence_number_last4, licence_expiry, status) values
  ('cccccccc-0000-0000-0000-0000000000d1', '1990-01-01', 'US', 'AB12', '2040-01-01', 'verified');
insert into driver_documents (user_id, kind, storage_path, mime_type, size_bytes) values
  ('cccccccc-0000-0000-0000-0000000000d1', 'licence_front', 'd1/front.jpg', 'image/jpeg', 100);
insert into contact_channels (user_id, phone_e164) values ('cccccccc-0000-0000-0000-0000000000d1', '+15550001111');
insert into notification_preferences (user_id, category, channel, enabled) values ('cccccccc-0000-0000-0000-0000000000d1', 'reminders', 'email', false);

select test.assert((export_user_data('cccccccc-0000-0000-0000-0000000000d1') #>> '{account,email}') = 'erase.me@example.com', 'the export has the account');
select test.assert(jsonb_array_length(export_user_data('cccccccc-0000-0000-0000-0000000000d1') -> 'bookings') = 1, 'and their bookings');
select test.assert((export_user_data('cccccccc-0000-0000-0000-0000000000d1') #>> '{driverProfile,licence_number_last4}') = 'AB12', 'and their licence details');
select test.assert(jsonb_array_length(export_user_data('cccccccc-0000-0000-0000-0000000000d2') -> 'bookings') = 0, 'but nothing of anyone else');

-- Open bookings block erasure.
select test.expect_error($$select erase_user('cccccccc-0000-0000-0000-0000000000d1')$$, 'BE001');
update bookings set status = 'cancelled' where reference = 'BC-E00001';

insert into data_requests (user_id, kind, status) values ('cccccccc-0000-0000-0000-0000000000d1', 'erase', 'processing');
select test.assert((erase_user('cccccccc-0000-0000-0000-0000000000d1') ->> 'bookingsAnonymised')::int = 1, 'erasure anonymises the booking');
select test.assert((select customer_name = 'Deleted user' and phone is null and email like 'deleted-%@deleted.invalid' and user_id is null from bookings where reference = 'BC-E00001'), 'no name, email, phone or account link remains');
select test.assert((select total_amount = 100 and status = 'cancelled' from bookings where reference = 'BC-E00001'), 'but the financial facts remain');
select test.assert(not exists (select 1 from driver_profiles where user_id = 'cccccccc-0000-0000-0000-0000000000d1'), 'licence details are gone');
select test.assert(not exists (select 1 from driver_documents where user_id = 'cccccccc-0000-0000-0000-0000000000d1'), 'and documents');
select test.assert(not exists (select 1 from contact_channels where user_id = 'cccccccc-0000-0000-0000-0000000000d1'), 'and contact details');
select test.assert(not exists (select 1 from notification_preferences where user_id = 'cccccccc-0000-0000-0000-0000000000d1'), 'and preferences');
select test.assert((select anon_id = 'erased' and user_id is null from consents where purpose = 'analytics' and granted and anon_id = 'erased'), 'consent records are kept without the person');
select test.assert((select status = 'done' from data_requests where kind = 'erase'), 'the request is marked done');
select test.assert(jsonb_array_length(export_user_data('cccccccc-0000-0000-0000-0000000000d1') -> 'bookings') = 0, 'and nothing is left to export');

-- ---------------------------------------------------------------
-- Retention never touches money
-- ---------------------------------------------------------------
insert into notifications (channel, template, address, dedupe_key, status, created_at) values
  ('email', 'x', 'a@example.com', 'old-1', 'sent', now() - interval '400 days'),
  ('email', 'x', 'a@example.com', 'new-1', 'sent', now() - interval '1 day'),
  ('email', 'x', 'a@example.com', 'old-queued', 'queued', now() - interval '400 days');
update rate_limits set window_start = now() - interval '3 days' where key = 'k2';
select test.assert((apply_retention() ->> 'notifications')::int = 1, 'an old sent notification is deleted');
select test.assert(exists (select 1 from notifications where dedupe_key = 'new-1'), 'a recent one stays');
select test.assert(exists (select 1 from notifications where dedupe_key = 'old-queued'), 'and one still waiting to be sent stays');
select test.assert(not exists (select 1 from rate_limits where key = 'k2'), 'old rate-limit windows are cleared');
select test.assert(exists (select 1 from bookings where reference = 'BC-E00001'), 'bookings are never deleted by retention');

-- ---------------------------------------------------------------
-- Translations and access
-- ---------------------------------------------------------------
insert into vehicle_translations (vehicle_id, lang, description) values ('11111111-1111-1111-1111-111111111111', 'de', 'Ein zuverlässiges Auto');
select test.expect_error($$insert into vehicle_translations (vehicle_id, lang, description) values ('11111111-1111-1111-1111-111111111111', 'en', 'x')$$, '23514');

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000d2', true);
set local role authenticated;
select test.assert((select count(*) from vehicle_translations) = 1, 'translations are public');
select test.assert((select count(*) from policy_versions) = 3, 'so are policy versions');
select test.assert((select count(*) from consents) = 0, 'consent records are not');
select test.assert((select count(*) from rate_limits) = 0, 'nor rate limits');
select test.assert((select count(*) from data_requests) = 0, 'and others cannot see data requests');
reset role;
select test.assert(not has_function_privilege('authenticated', 'erase_user(uuid)', 'execute'), 'signed-in users cannot call erasure directly');
select test.assert(not has_function_privilege('anon', 'export_user_data(uuid)', 'execute'), 'nor export');
select test.assert(not has_function_privilege('authenticated', 'rate_limit_hit(text,integer,integer)', 'execute'), 'nor the rate limiter');
