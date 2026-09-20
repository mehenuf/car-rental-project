-- Onboarding columns and address privacy.
select test.assert(exists (select 1 from information_schema.columns where table_name = 'providers' and column_name in ('registration_number', 'contact_phone', 'submitted_at', 'reviewed_at', 'review_note') having count(*) = 5), 'providers has the onboarding columns');
select test.assert(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'branches' and column_name = 'address'), 'branches no longer has a public address column');

insert into providers (id, type, legal_name, display_name, country_code, default_currency, status) values
  ('bbbbbbbb-0000-0000-0000-000000000070', 'individual', 'Ola Owner', 'Ola', 'US', 'USD', 'approved');
insert into branches (id, provider_id, code, name, city, country, country_code, currency, turnaround_minutes) values
  (970, 'bbbbbbbb-0000-0000-0000-000000000070', 'OLA-1', 'Ola Driveway', 'Austin', 'United States', 'US', 'USD', 0);
insert into branch_private (branch_id, provider_id, address) values (970, 'bbbbbbbb-0000-0000-0000-000000000070', '12 Secret Street');
select test.expect_error($$insert into branch_private (branch_id, provider_id, address) values (1, 'bbbbbbbb-0000-0000-0000-000000000070', 'x')$$, '23503');

-- Listing status gates availability: existing units are approved, a draft car is never offered.
select test.assert(exists (select 1 from free_units('11111111-1111-1111-1111-111111111111', 1, 1, '2032-01-01 10:00+00', '2032-01-02 10:00+00')), 'existing (backfilled) units are approved and offered');
insert into fleet_units (id, provider_id, branch_id, vehicle_id, plate, listing_status) values
  ('eeeeeeee-0000-0000-0000-000000000070', 'bbbbbbbb-0000-0000-0000-000000000070', 970, '33333333-3333-3333-3333-333333333333', 'OLA-MINI', 'draft');
select test.assert(not exists (select 1 from free_units('33333333-3333-3333-3333-333333333333', 970, 970, '2032-01-01 10:00+00', '2032-01-02 10:00+00')), 'a draft car is not offered');
update fleet_units set listing_status = 'pending_review' where id = 'eeeeeeee-0000-0000-0000-000000000070';
select test.assert(not exists (select 1 from free_units('33333333-3333-3333-3333-333333333333', 970, 970, '2032-01-01 10:00+00', '2032-01-02 10:00+00')), 'a car pending review is not offered');
update fleet_units set listing_status = 'approved' where id = 'eeeeeeee-0000-0000-0000-000000000070';
select test.assert(exists (select 1 from free_units('33333333-3333-3333-3333-333333333333', 970, 970, '2032-01-01 10:00+00', '2032-01-02 10:00+00')), 'an approved car is offered');
select test.expect_error($$update fleet_units set listing_status = 'live' where id = 'eeeeeeee-0000-0000-0000-000000000070'$$, '23514');

-- Documents.
insert into provider_documents (id, provider_id, kind, storage_path, file_name, mime_type, size_bytes) values
  ('d0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000070', 'id_document', 'bbbbbbbb-0000-0000-0000-000000000070/a-id.pdf', 'id.pdf', 'application/pdf', 1000);
select test.assert((select status from provider_documents where id = 'd0000000-0000-0000-0000-000000000001') = 'pending', 'new documents are pending review');
select test.expect_error($$insert into provider_documents (provider_id, kind, storage_path, file_name, mime_type, size_bytes) values ('bbbbbbbb-0000-0000-0000-000000000070', 'id_document', 'p/big.pdf', 'big.pdf', 'application/pdf', 5242881)$$, '23514');
select test.expect_error($$insert into provider_documents (provider_id, kind, storage_path, file_name, mime_type, size_bytes) values ('bbbbbbbb-0000-0000-0000-000000000070', 'id_document', 'p/x.exe', 'x.exe', 'application/x-msdownload', 10)$$, '23514');
select test.expect_error($$insert into provider_documents (provider_id, kind, storage_path, file_name, mime_type, size_bytes) values ('bbbbbbbb-0000-0000-0000-000000000070', 'selfie', 'p/s.png', 's.png', 'image/png', 10)$$, '23514');
select test.expect_error($$insert into provider_documents (provider_id, kind, storage_path, file_name, mime_type, size_bytes) values ('bbbbbbbb-0000-0000-0000-000000000070', 'id_document', 'bbbbbbbb-0000-0000-0000-000000000070/a-id.pdf', 'id.pdf', 'application/pdf', 10)$$, '23505');

-- Payout account keeps only masked details.
insert into payout_accounts (provider_id, account_holder, bank_name, account_last4, country_code) values
  ('bbbbbbbb-0000-0000-0000-000000000070', 'Ola Owner', 'Test Bank', '4242', 'US');
select test.expect_error($$insert into payout_accounts (provider_id, account_holder, bank_name, account_last4, country_code) values ('00000000-0000-0000-0000-00000000b0c1', 'X', 'Y', '12ab', 'US')$$, '23514');

-- Inspections drive the booking lifecycle.
create function test.mk_confirmed(p_ref text, p_day text) returns uuid language sql as $$
  select (create_booking_atomic('11111111-1111-1111-1111-111111111111', 1, 1,
    (p_day || ' 10:00+00')::timestamptz, (p_day || ' 10:00+00')::timestamptz + interval '2 days',
    'T', 't@example.com', 100, p_ref, null, null, 'web', null, null, null)).id
$$;
select test.mk_confirmed('BC-I00001', '2032-03-01');
select transition_booking((select id from bookings where reference = 'BC-I00001'), 'confirmed');

select test.expect_error($$select record_inspection((select id from bookings where reference = 'BC-I00001'), 'return', 1000, 'full', null, '{}', null)$$, 'BP006');
select test.assert((record_inspection((select id from bookings where reference = 'BC-I00001'), 'pickup', 1000, 'full', 'Small scratch on the left door', array['p/photo1.jpg'], null)).status = 'active', 'a pickup inspection activates the booking');
select test.expect_error($$select record_inspection((select id from bookings where reference = 'BC-I00001'), 'pickup', 1000, 'full', null, '{}', null)$$, 'BP006');
select test.expect_error($$select record_inspection((select id from bookings where reference = 'BC-I00001'), 'return', 900, 'half', null, '{}', null)$$, 'BP007');
select test.assert((record_inspection((select id from bookings where reference = 'BC-I00001'), 'return', 1250, 'half', null, '{}', null)).status = 'completed', 'a return inspection completes the booking');
select test.assert((select mileage_km from fleet_units where id = (select fleet_unit_id from bookings where reference = 'BC-I00001')) = 1250, 'and updates the unit mileage');
select test.assert((select count(*) from booking_inspections where booking_id = (select id from bookings where reference = 'BC-I00001')) = 2, 'both inspections are stored');
select test.expect_error($$select record_inspection('99999999-9999-9999-9999-999999999999', 'pickup', 1, 'full', null, '{}', null)$$, 'P0002');
select test.assert(not has_function_privilege('anon', 'record_inspection(uuid,text,integer,text,text,text[],uuid)', 'execute'), 'anon cannot record inspections');

-- Access: members read their provider's documents, inspections and payout account; strangers see nothing.
insert into auth.users (id) values ('cccccccc-0000-0000-0000-0000000000d1'), ('cccccccc-0000-0000-0000-0000000000d2');
insert into provider_members (provider_id, user_id, role) values
  ('bbbbbbbb-0000-0000-0000-000000000070', 'cccccccc-0000-0000-0000-0000000000d1', 'owner');

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000d1', true);
set local role authenticated;
select test.assert((select count(*) from provider_documents) = 1, 'owner reads their documents');
select test.assert((select count(*) from payout_accounts) = 1, 'owner reads the payout account');
select test.assert((select count(*) from branch_private) = 1, 'owner reads the private address');
reset role;

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000d2', true);
set local role authenticated;
select test.assert((select count(*) from provider_documents) = 0, 'a stranger sees no documents');
select test.assert((select count(*) from payout_accounts) = 0, 'a stranger sees no payout account');
select test.assert((select count(*) from branch_private) = 0, 'a stranger cannot read private addresses');
select test.assert((select count(*) from booking_inspections) = 0, 'a stranger sees no inspections');
reset role;
