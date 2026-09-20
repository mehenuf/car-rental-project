-- Helpers (created inside this test's transaction, rolled back afterwards).
create function test.snap(p_total bigint) returns jsonb language sql as $$
  select jsonb_build_object('quote', jsonb_build_object(
    'totalMinor', p_total, 'serviceFeeMinor', 500, 'commissionMinor', 1500,
    'providerPayoutMinor', p_total - 2000, 'platformRevenueMinor', 2000,
    'currency', 'USD', 'pickupAt', '2033-01-01T00:00:00Z', 'cancellationTiers', '[]'::jsonb))
$$;

create function test.mk(p_ref text, p_day text, p_email text, p_user uuid default null) returns uuid language sql as $$
  select (create_booking_atomic('11111111-1111-1111-1111-111111111111', 1, 1,
    (p_day || ' 10:00+00')::timestamptz, (p_day || ' 10:00+00')::timestamptz + interval '2 days',
    'Test Renter', p_email, 100, p_ref, null, null, 'web', null, p_user, test.snap(10000))).id
$$;

insert into auth.users (id, email, email_confirmed_at) values
  ('cccccccc-0000-0000-0000-0000000000f1', 'renter@example.com', now()),
  ('cccccccc-0000-0000-0000-0000000000f2', 'unverified@example.com', null),
  ('cccccccc-0000-0000-0000-0000000000f3', 'young@example.com', now()),
  ('cccccccc-0000-0000-0000-0000000000f4', 'noprofile@example.com', now());

-- Driver profiles: a pending or verified profile needs the details a reviewer needs.
select test.expect_error($$insert into driver_profiles (user_id, status) values ('cccccccc-0000-0000-0000-0000000000f1', 'pending')$$, '23514');
select test.expect_error($$insert into driver_profiles (user_id, date_of_birth, licence_country, licence_number_last4, licence_expiry, status) values ('cccccccc-0000-0000-0000-0000000000f1', '1990-01-01', 'US', 'AB-1', '2034-01-01', 'pending')$$, '23514');
insert into driver_profiles (user_id) values ('cccccccc-0000-0000-0000-0000000000f4');
select test.assert((select status from driver_profiles where user_id = 'cccccccc-0000-0000-0000-0000000000f4') = 'unverified', 'a new profile starts unverified');

-- Documents: type, size and path rules.
insert into driver_documents (user_id, kind, storage_path, mime_type, size_bytes) values
  ('cccccccc-0000-0000-0000-0000000000f1', 'licence_front', 'cccccccc-0000-0000-0000-0000000000f1/front.jpg', 'image/jpeg', 1000);
select test.expect_error($$insert into driver_documents (user_id, kind, storage_path, mime_type, size_bytes) values ('cccccccc-0000-0000-0000-0000000000f1', 'licence_back', 'p/big.jpg', 'image/jpeg', 5242881)$$, '23514');
select test.expect_error($$insert into driver_documents (user_id, kind, storage_path, mime_type, size_bytes) values ('cccccccc-0000-0000-0000-0000000000f1', 'licence_back', 'p/x.exe', 'application/x-msdownload', 10)$$, '23514');
select test.expect_error($$insert into driver_documents (user_id, kind, storage_path, mime_type, size_bytes) values ('cccccccc-0000-0000-0000-0000000000f1', 'selfie', 'p/s.pdf', 'application/pdf', 10)$$, '23514');
select test.expect_error($$insert into driver_documents (user_id, kind, storage_path, mime_type, size_bytes) values ('cccccccc-0000-0000-0000-0000000000f1', 'licence_back', 'cccccccc-0000-0000-0000-0000000000f1/front.jpg', 'image/jpeg', 10)$$, '23505');

-- Receipts: gapless, idempotent, only for succeeded charges.
select test.mk('BC-R00001', '2033-01-10', 'a@example.com');
select test.mk('BC-R00002', '2033-01-20', 'b@example.com');
insert into payments (id, booking_id, kind, method, provider, status, amount_minor, currency, idempotency_key) values
  ('a0000000-0000-0000-0000-000000000001', (select id from bookings where reference = 'BC-R00001'), 'charge', 'card', 'simulated', 'succeeded', 10000, 'USD', 'rc-1'),
  ('a0000000-0000-0000-0000-000000000002', (select id from bookings where reference = 'BC-R00002'), 'charge', 'card', 'simulated', 'succeeded', 10000, 'USD', 'rc-2'),
  ('a0000000-0000-0000-0000-000000000003', (select id from bookings where reference = 'BC-R00002'), 'charge', 'card', 'simulated', 'failed', 10000, 'USD', 'rc-3'),
  ('a0000000-0000-0000-0000-000000000004', (select id from bookings where reference = 'BC-R00002'), 'refund', 'card', 'simulated', 'succeeded', 1000, 'USD', 'rc-4');

select test.assert((issue_receipt('a0000000-0000-0000-0000-000000000001')).number = 'R-' || extract(year from now())::int || '-000001', 'the first receipt is number 1 of the year');
select test.assert((issue_receipt('a0000000-0000-0000-0000-000000000001')).number = 'R-' || extract(year from now())::int || '-000001', 'issuing again returns the same receipt');
select test.assert((select count(*) from receipts) = 1, 'and creates no duplicate');
select test.assert((issue_receipt('a0000000-0000-0000-0000-000000000002')).number = 'R-' || extract(year from now())::int || '-000002', 'the next receipt is number 2, with no gap');
select test.assert((select snapshot ->> 'reference' from receipts where number like '%000002') = 'BC-R00002', 'the receipt stores the itemised snapshot');
select test.assert((select (snapshot -> 'quote' ->> 'totalMinor')::int from receipts where number like '%000002') = 10000, 'including the quote');
select test.expect_error($$select issue_receipt('a0000000-0000-0000-0000-000000000003')$$, 'BA001');
select test.expect_error($$select issue_receipt('a0000000-0000-0000-0000-000000000004')$$, 'BA001');
select test.expect_error($$select issue_receipt('99999999-9999-9999-9999-999999999999')$$, 'P0002');

-- Claiming guest bookings.
select test.mk('BC-G00001', '2033-02-01', 'Renter@Example.com');
select test.mk('BC-G00002', '2033-02-05', 'renter@example.com');
select test.mk('BC-G00003', '2033-02-09', 'someone-else@example.com');
select test.expect_error($$select claim_guest_bookings('cccccccc-0000-0000-0000-0000000000f2', 'unverified@example.com')$$, 'BA002');
select test.expect_error($$select claim_guest_bookings('cccccccc-0000-0000-0000-0000000000f1', 'someone-else@example.com')$$, 'BA002');
select test.assert(claim_guest_bookings('cccccccc-0000-0000-0000-0000000000f1', 'renter@example.com') = 2, 'a verified account claims the bookings made with its email');
select test.assert((select count(*) from bookings where user_id = 'cccccccc-0000-0000-0000-0000000000f1') = 2, 'they are attached to the account');
select test.assert((select user_id from bookings where reference = 'BC-G00003') is null, 'other people''s bookings are untouched');
select test.assert(claim_guest_bookings('cccccccc-0000-0000-0000-0000000000f1', 'renter@example.com') = 0, 'claiming twice claims nothing more');
select test.assert((select count(*) from guest_claims) = 2, 'each claim is recorded');

-- Pickup gate.
create function test.confirmed(p_ref text, p_day text, p_email text, p_user uuid default null) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  v_id := test.mk(p_ref, p_day, p_email, p_user);
  perform transition_booking(v_id, 'confirmed');
  return v_id;
end $$;

select test.confirmed('BC-P00001', '2033-03-01', 'p1@example.com', 'cccccccc-0000-0000-0000-0000000000f4');
select test.confirmed('BC-P00002', '2033-03-10', 'p2@example.com');
select test.confirmed('BC-P00003', '2033-03-20', 'p3@example.com', 'cccccccc-0000-0000-0000-0000000000f1');
select test.confirmed('BC-P00004', '2033-04-01', 'p4@example.com', 'cccccccc-0000-0000-0000-0000000000f3');
select test.confirmed('BC-P00005', '2033-04-10', 'p5@example.com', 'cccccccc-0000-0000-0000-0000000000f1');

select test.expect_error($$select record_inspection((select id from bookings where reference = 'BC-P00001'), 'pickup', 100, 'full', null, '{}', null)$$, 'BP008');
select test.expect_error($$select record_inspection((select id from bookings where reference = 'BC-P00002'), 'pickup', 100, 'full', null, '{}', null)$$, 'BP008');

-- A verified profile whose licence expires before the rental ends is refused.
insert into driver_profiles (user_id, date_of_birth, licence_country, licence_number_last4, licence_expiry, status) values
  ('cccccccc-0000-0000-0000-0000000000f1', '1990-01-01', 'US', 'AB12', '2033-03-21', 'verified');
select test.expect_error($$select record_inspection((select id from bookings where reference = 'BC-P00003'), 'pickup', 100, 'full', null, '{}', null)$$, 'BP009');

-- Under the provider's minimum age (21 by default) is refused.
insert into driver_profiles (user_id, date_of_birth, licence_country, licence_number_last4, licence_expiry, status) values
  ('cccccccc-0000-0000-0000-0000000000f3', '2015-01-01', 'US', 'CD34', '2040-01-01', 'verified');
select test.expect_error($$select record_inspection((select id from bookings where reference = 'BC-P00004'), 'pickup', 100, 'full', null, '{}', null)$$, 'BP010');

-- A verified, valid, old-enough renter passes.
update driver_profiles set licence_expiry = '2040-01-01' where user_id = 'cccccccc-0000-0000-0000-0000000000f1';
select test.assert((record_inspection((select id from bookings where reference = 'BC-P00005'), 'pickup', 100, 'full', null, '{}', null)).status = 'active', 'a verified renter can collect the car');
select test.assert((select licence_override_reason from booking_inspections where booking_id = (select id from bookings where reference = 'BC-P00005') and kind = 'pickup') is null, 'no override is recorded');

-- The provider may override with a written reason, which is recorded.
select test.assert((record_inspection((select id from bookings where reference = 'BC-P00002'), 'pickup', 100, 'full', null, '{}', null, 'Checked the physical licence at the counter')).status = 'active', 'an override with a reason allows pickup');
select test.assert((select licence_override_reason from booking_inspections where booking_id = (select id from bookings where reference = 'BC-P00002') and kind = 'pickup') = 'Checked the physical licence at the counter', 'and the reason is stored');
select test.expect_error($$select record_inspection((select id from bookings where reference = 'BC-P00001'), 'pickup', 100, 'full', null, '{}', null, '   ')$$, 'BP008');

-- Access: only the service role touches these tables and functions.
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000f1', true);
set local role authenticated;
select test.assert((select count(*) from driver_profiles) = 0, 'a signed-in user cannot read driver profiles directly');
select test.assert((select count(*) from driver_documents) = 0, 'or driver documents');
select test.assert((select count(*) from receipts) = 0, 'or receipts');
select test.assert((select count(*) from guest_claims) = 0, 'or claims');
reset role;
select test.assert(not has_function_privilege('authenticated', 'issue_receipt(uuid)', 'execute'), 'signed-in users cannot issue receipts');
select test.assert(not has_function_privilege('anon', 'claim_guest_bookings(uuid,text)', 'execute'), 'anon cannot claim bookings');
select test.assert(not has_function_privilege('authenticated', 'record_inspection(uuid,text,integer,text,text,text[],uuid,text)', 'execute'), 'signed-in users cannot record inspections');
select test.assert(has_function_privilege('service_role', 'record_inspection(uuid,text,integer,text,text,text[],uuid,text)', 'execute'), 'the service role can');
