-- A provider member cannot approve their own car; the legacy dashboard data is closed to API roles.
insert into providers (id, type, legal_name, display_name, country_code, default_currency, status) values
  ('bbbbbbbb-0000-0000-0000-000000000080', 'individual', 'Hardy Host', 'Hardy', 'US', 'USD', 'approved');
insert into branches (id, provider_id, code, name, city, country, country_code, currency, turnaround_minutes) values
  (980, 'bbbbbbbb-0000-0000-0000-000000000080', 'HRD-1', 'Hardy Driveway', 'Austin', 'United States', 'US', 'USD', 0);
insert into fleet_units (id, provider_id, branch_id, vehicle_id, plate, listing_status) values
  ('eeeeeeee-0000-0000-0000-000000000080', 'bbbbbbbb-0000-0000-0000-000000000080', 980, '33333333-3333-3333-3333-333333333333', 'HRD-ONE', 'draft');
insert into auth.users (id) values ('cccccccc-0000-0000-0000-0000000000e1');
insert into provider_members (provider_id, user_id, role) values
  ('bbbbbbbb-0000-0000-0000-000000000080', 'cccccccc-0000-0000-0000-0000000000e1', 'owner');

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000e1', true);
set local role authenticated;
select test.expect_error($$update fleet_units set listing_status = 'approved' where id = 'eeeeeeee-0000-0000-0000-000000000080'$$, 'BS003');
select test.expect_error($$update fleet_units set review_note = 'looks fine' where id = 'eeeeeeee-0000-0000-0000-000000000080'$$, 'BS003');
update fleet_units set mileage_km = 500 where id = 'eeeeeeee-0000-0000-0000-000000000080';
select test.assert((select mileage_km from fleet_units where id = 'eeeeeeee-0000-0000-0000-000000000080') = 500, 'an owner can still edit ordinary fields of their car');
insert into fleet_units (id, provider_id, branch_id, vehicle_id, plate, listing_status) values
  ('eeeeeeee-0000-0000-0000-000000000081', 'bbbbbbbb-0000-0000-0000-000000000080', 980, '33333333-3333-3333-3333-333333333333', 'HRD-TWO', 'approved');
select test.assert((select listing_status from fleet_units where id = 'eeeeeeee-0000-0000-0000-000000000081') = 'draft', 'a car added through the API starts as a draft, whatever was sent');
reset role;

-- Server code and staff are not limited.
update fleet_units set listing_status = 'approved' where id = 'eeeeeeee-0000-0000-0000-000000000080';
select test.assert((select listing_status from fleet_units where id = 'eeeeeeee-0000-0000-0000-000000000080') = 'approved', 'the service role can approve a car');

-- Legacy dashboard data.
insert into daily_stats (date, revenue, sales_count, purchases) values ('2032-01-01', 10, 1, 1);
set local role anon;
select test.expect_error($$select * from daily_stats$$, '42501');
select test.expect_error($$select * from v_best_sellers$$, '42501');
select test.expect_error($$select * from v_sales_by_country$$, '42501');
reset role;
set local role authenticated;
select test.expect_error($$select * from daily_stats$$, '42501');
select test.expect_error($$select * from v_best_sellers$$, '42501');
reset role;
