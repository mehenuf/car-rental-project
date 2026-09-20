-- Platform settings: exactly one row, with the default commission.
select test.assert((select count(*) from platform_settings) = 1, 'one platform_settings row');
select test.assert((select commission_bp from platform_settings) = 1500, 'default commission is 15%');
select test.expect_error($$insert into platform_settings (id) values (false)$$, '23514');
select test.expect_error($$insert into platform_settings default values$$, '23505');

-- Backfill: one rate plan per (vehicle, branch that has units), price_per_day converted to minor units.
select test.assert((select base_daily_minor from rate_plans where vehicle_id = '11111111-1111-1111-1111-111111111111' and branch_id = 1) = 4800, 'civic plan = 4800');
select test.assert((select base_daily_minor from rate_plans where vehicle_id = '22222222-2222-2222-2222-222222222222' and branch_id = 2) = 9900, 'tahoe plan = 9900');
select test.assert((select currency from rate_plans where vehicle_id = '33333333-3333-3333-3333-333333333333') = 'USD', 'plan currency comes from the branch');
select test.assert((select count(*) from rate_plans) = 3, 'one plan per vehicle/branch pair');

-- Rate plan constraints.
select test.expect_error($$insert into rate_plans (provider_id, vehicle_id, branch_id, currency, base_daily_minor) values ('00000000-0000-0000-0000-00000000b0c1', '11111111-1111-1111-1111-111111111111', 1, 'USD', 5000)$$, '23505');
select test.expect_error($$insert into rate_plans (provider_id, vehicle_id, branch_id, currency, base_daily_minor) values ('00000000-0000-0000-0000-00000000b0c1', '22222222-2222-2222-2222-222222222222', 1, 'EUR', 5000)$$, '23514');
select test.expect_error($$insert into rate_plans (provider_id, vehicle_id, branch_id, currency, base_daily_minor, weekend_uplift_bp) values ('00000000-0000-0000-0000-00000000b0c1', '22222222-2222-2222-2222-222222222222', 1, 'USD', 5000, 20000)$$, '23514');
select test.expect_error($$insert into rate_plans (provider_id, vehicle_id, branch_id, currency, base_daily_minor) values ('00000000-0000-0000-0000-00000000b0c1', '22222222-2222-2222-2222-222222222222', 1, 'USD', 0)$$, '23514');

-- Seasons may not overlap within a plan.
insert into rate_seasons (rate_plan_id, provider_id, during, daily_minor)
select id, provider_id, daterange('2030-07-01', '2030-08-01'), 6000 from rate_plans where vehicle_id = '11111111-1111-1111-1111-111111111111';
select test.expect_error($$insert into rate_seasons (rate_plan_id, provider_id, during, daily_minor) select id, provider_id, daterange('2030-07-15', '2030-08-15'), 7000 from rate_plans where vehicle_id = '11111111-1111-1111-1111-111111111111'$$, '23P01');

-- Extras.
insert into extras (provider_id, code, name, kind, pricing, unit_price_minor, currency) values
  ('00000000-0000-0000-0000-00000000b0c1', 'seat', 'Child seat', 'extra', 'per_day', 1000, 'USD');
select test.expect_error($$insert into extras (provider_id, code, name, kind, pricing, unit_price_minor, currency) values ('00000000-0000-0000-0000-00000000b0c1', 'seat', 'Dup', 'extra', 'per_day', 1000, 'USD')$$, '23505');
select test.expect_error($$insert into extras (provider_id, code, name, kind, pricing, unit_price_minor, currency) values ('00000000-0000-0000-0000-00000000b0c1', 'x', 'X', 'extra', 'hourly', 1000, 'USD')$$, '23514');

-- Policies, one-way fees, tax rules, promo codes.
insert into provider_policies (provider_id, deposit_type, deposit_value) values ('00000000-0000-0000-0000-00000000b0c1', 'fixed', 20000);
select test.expect_error($$insert into provider_policies (provider_id, deposit_type, deposit_value) values ('00000000-0000-0000-0000-00000000b0c1', 'fixed', 1)$$, '23505');

insert into one_way_fees (provider_id, from_branch_id, to_branch_id, amount_minor) values ('00000000-0000-0000-0000-00000000b0c1', 1, 2, 3000);
insert into providers (id, type, legal_name, display_name, country_code, default_currency, status) values
  ('bbbbbbbb-0000-0000-0000-000000000006', 'individual', 'Pat', 'Pat', 'US', 'USD', 'approved');
insert into branches (id, provider_id, code, name, city, country, country_code, currency) values
  (960, 'bbbbbbbb-0000-0000-0000-000000000006', 'PAT-1', 'Pat', 'Austin', 'United States', 'US', 'USD');
select test.expect_error($$insert into one_way_fees (provider_id, from_branch_id, to_branch_id, amount_minor) values ('00000000-0000-0000-0000-00000000b0c1', 1, 960, 100)$$, '23503');

insert into tax_rules (country_code, name, rate_bp, applies_to, inclusive) values ('GB', 'VAT', 2000, array['rental', 'extras'], true);
select test.expect_error($$insert into tax_rules (country_code, name, rate_bp, applies_to, inclusive) values ('GB', 'Bad', 100, array['nothing'], false)$$, '23514');
select test.expect_error($$insert into tax_rules (country_code, name, rate_bp, applies_to, inclusive) values ('GB', 'Empty', 100, array[]::text[], false)$$, '23514');

insert into promo_codes (code, issuer, discount_type, value) values ('SAVE10', 'platform', 'percent', 1000);
select test.expect_error($$insert into promo_codes (code, issuer, discount_type, value) values ('save10', 'platform', 'percent', 500)$$, '23505');
select test.expect_error($$insert into promo_codes (code, issuer, discount_type, value) values ('BIG', 'platform', 'percent', 20000)$$, '23514');
select test.expect_error($$insert into promo_codes (code, issuer, discount_type, value) values ('FIX', 'platform', 'fixed', 500)$$, '23514');
select test.expect_error($$insert into promo_codes (code, issuer, discount_type, value) values ('PRV', 'provider', 'percent', 500)$$, '23514');

-- Billable days rule on the generated column (24h periods rounded up after a 59 minute grace).
insert into bookings (id, reference, customer_name, email, pickup_at, dropoff_at, total_amount) values
  ('eeeeeeee-0000-0000-0000-0000000000d1', 'BC-D00001', 'D', 'd@example.com', '2030-01-01 10:00+00', '2030-01-02 10:00+00', 1),
  ('eeeeeeee-0000-0000-0000-0000000000d2', 'BC-D00002', 'D', 'd@example.com', '2030-01-01 10:00+00', '2030-01-02 10:59+00', 1),
  ('eeeeeeee-0000-0000-0000-0000000000d3', 'BC-D00003', 'D', 'd@example.com', '2030-01-01 10:00+00', '2030-01-02 11:00+00', 1),
  ('eeeeeeee-0000-0000-0000-0000000000d4', 'BC-D00004', 'D', 'd@example.com', '2030-01-01 10:00+00', '2030-01-01 12:00+00', 1),
  ('eeeeeeee-0000-0000-0000-0000000000d5', 'BC-D00005', 'D', 'd@example.com', '2030-01-01 10:00+00', '2030-01-04 10:30+00', 1);
select test.assert((select days from bookings where reference = 'BC-D00001') = 1, '24h is 1 day');
select test.assert((select days from bookings where reference = 'BC-D00002') = 1, '24h59m is 1 day');
select test.assert((select days from bookings where reference = 'BC-D00003') = 2, '25h is 2 days');
select test.assert((select days from bookings where reference = 'BC-D00004') = 1, '2h is the 1 day minimum');
select test.assert((select days from bookings where reference = 'BC-D00005') = 3, '72h30m is 3 days');

-- create_booking_atomic stores the price snapshot.
select test.assert(
  (select (b).price_snapshot ->> 'totalMinor' = '4800'
   from (select create_booking_atomic('11111111-1111-1111-1111-111111111111', 1, 1, '2030-09-01 10:00+00', '2030-09-02 10:00+00', 'S', 's@example.com', 48, 'BC-S00001', null, null, 'web', null, null, '{"totalMinor": 4800}'::jsonb) as b) s),
  'snapshot is stored on the booking');
select test.assert((select price_snapshot is null from bookings where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'legacy bookings have no snapshot');

-- Access: provider members read their config, strangers and anon do not; platform tables are server-only.
insert into auth.users (id) values ('cccccccc-0000-0000-0000-0000000000b1'), ('cccccccc-0000-0000-0000-0000000000b2');
insert into provider_members (provider_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000b0c1', 'cccccccc-0000-0000-0000-0000000000b1', 'manager');

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000b1', true);
set local role authenticated;
select test.assert((select count(*) from rate_plans) = 3, 'manager reads the provider rate plans');
select test.assert((select count(*) from extras) = 1, 'manager reads extras');
update rate_plans set base_daily_minor = 5000 where vehicle_id = '11111111-1111-1111-1111-111111111111';
select test.assert((select base_daily_minor from rate_plans where vehicle_id = '11111111-1111-1111-1111-111111111111') = 5000, 'manager can edit a rate plan');
reset role;

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000b2', true);
set local role authenticated;
select test.assert((select count(*) from rate_plans) = 0, 'a stranger sees no rate plans');
select test.assert((select count(*) from extras) = 0, 'a stranger sees no extras');
select test.assert((select count(*) from platform_settings) = 0, 'platform settings are server-only');
select test.assert((select count(*) from tax_rules) = 0, 'tax rules are server-only');
reset role;
