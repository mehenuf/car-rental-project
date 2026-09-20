-- Backfill: the future confirmed booking got a unit and a buffered occupancy row.
select test.assert((select fleet_unit_id from bookings where id = 'aaaaaaaa-0000-0000-0000-000000000002') is not null, 'future booking assigned a unit');
select test.assert((select upper(o.during) - b.dropoff_at from unit_occupancy o join bookings b on b.id = o.booking_id where b.id = 'aaaaaaaa-0000-0000-0000-000000000002') = interval '60 minutes', 'occupancy includes the 60 minute turnaround buffer');
select test.assert((select fleet_unit_id from bookings where id = 'aaaaaaaa-0000-0000-0000-000000000001') is null, 'past bookings stay unassigned');
select test.assert((select pickup_branch_id from bookings where id = 'aaaaaaaa-0000-0000-0000-000000000004') = 1, 'pending booking without branches inherits its unit branch');

-- Cancelling releases the unit.
select transition_booking('aaaaaaaa-0000-0000-0000-000000000002', 'cancelled');
select test.assert(not exists (select 1 from unit_occupancy where booking_id = 'aaaaaaaa-0000-0000-0000-000000000002'), 'cancel deletes the occupancy row');

-- Basic booking: civic at branch 1.
select test.assert(
  (select (b).status = 'pending' and (b).fleet_unit_id is not null and (b).provider_id = '00000000-0000-0000-0000-00000000b0c1'
          and (b).pickup_branch_id = 1 and (b).currency = 'USD'
   from (select create_booking_atomic('11111111-1111-1111-1111-111111111111', 1, 1, '2030-03-01 10:00+00', '2030-03-03 10:00+00', 'A', 'a@example.com', 96, 'BC-T00001') as b) s),
  'basic booking is pending, has a unit, provider, branch and currency');
select test.assert((select count(*) from unit_occupancy o join bookings b on b.id = o.booking_id where b.reference = 'BC-T00001') = 1, 'booking has one occupancy row');

-- Two units means two bookings for the same dates; the third fails with BC002.
select create_booking_atomic('11111111-1111-1111-1111-111111111111', 1, 1, '2030-03-01 10:00+00', '2030-03-03 10:00+00', 'B', 'b@example.com', 96, 'BC-T00002');
select test.assert((select count(distinct fleet_unit_id) from bookings where reference in ('BC-T00001', 'BC-T00002')) = 2, 'the two bookings use different units');
select test.expect_error($$select create_booking_atomic('11111111-1111-1111-1111-111111111111', 1, 1, '2030-03-01 10:00+00', '2030-03-03 10:00+00', 'C', 'c@example.com', 96, 'BC-T00003')$$, 'BC002');

-- available_vehicle_ids reflects it.
select test.assert(not ('11111111-1111-1111-1111-111111111111' in (select available_vehicle_ids(1, 1, '2030-03-02 10:00+00', '2030-03-04 10:00+00'))), 'fully booked vehicle is not listed');
select test.assert('11111111-1111-1111-1111-111111111111' in (select available_vehicle_ids(1, 1, '2030-03-10 10:00+00', '2030-03-11 10:00+00')), 'vehicle is listed for a free range');

-- Turnaround buffer (tahoe: one unit at branch 2, 60 minute buffer).
select create_booking_atomic('22222222-2222-2222-2222-222222222222', 2, 2, '2030-04-01 10:00+00', '2030-04-02 10:00+00', 'D', 'd@example.com', 99, 'BC-T00004');
select test.expect_error($$select create_booking_atomic('22222222-2222-2222-2222-222222222222', 2, 2, '2030-04-02 10:30+00', '2030-04-03 10:00+00', 'E', 'e@example.com', 99, 'BC-T00005')$$, 'BC002');
select create_booking_atomic('22222222-2222-2222-2222-222222222222', 2, 2, '2030-04-02 11:00+00', '2030-04-03 10:00+00', 'F', 'f@example.com', 99, 'BC-T00006');

-- Validation.
select test.expect_error($$select create_booking_atomic('22222222-2222-2222-2222-222222222222', 2, 2, '2030-05-02 10:00+00', '2030-05-01 10:00+00', 'G', 'g@example.com', 99, 'BC-T00007')$$, 'BC004');
select test.expect_error($$select create_booking_atomic('22222222-2222-2222-2222-222222222222', 99999, 2, '2030-05-01 10:00+00', '2030-05-02 10:00+00', 'G', 'g@example.com', 99, 'BC-T00008')$$, 'BC003');

-- Individual owner: unit bookable only inside its availability window.
insert into providers (id, type, legal_name, display_name, country_code, default_currency, status) values
  ('bbbbbbbb-0000-0000-0000-000000000003', 'individual', 'Sam Owner', 'Sam', 'US', 'USD', 'approved');
insert into branches (id, provider_id, code, name, city, country, country_code, currency, turnaround_minutes) values
  (950, 'bbbbbbbb-0000-0000-0000-000000000003', 'SAM-1', 'Sam Driveway', 'Austin', 'United States', 'US', 'USD', 0);
insert into fleet_units (id, provider_id, branch_id, vehicle_id, plate, requires_window) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000003', 950, '33333333-3333-3333-3333-333333333333', 'SAM-MINI', true);
insert into availability_windows (fleet_unit_id, provider_id, during) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000003', tstzrange('2030-05-01 00:00+00', '2030-05-08 00:00+00', '[)'));
select test.assert(
  (select (b).fleet_unit_id = 'eeeeeeee-0000-0000-0000-000000000001'
   from (select create_booking_atomic('33333333-3333-3333-3333-333333333333', 950, 950, '2030-05-02 10:00+00', '2030-05-04 10:00+00', 'H', 'h@example.com', 120, 'BC-T00009') as b) s),
  'individual unit is booked inside its window');
select test.expect_error($$select create_booking_atomic('33333333-3333-3333-3333-333333333333', 950, 950, '2030-05-07 10:00+00', '2030-05-10 10:00+00', 'I', 'i@example.com', 120, 'BC-T00010')$$, 'BC002');

-- One-way stays within a provider.
select test.expect_error($$select create_booking_atomic('11111111-1111-1111-1111-111111111111', 1, 950, '2030-06-20 10:00+00', '2030-06-22 10:00+00', 'J', 'j@example.com', 96, 'BC-T00011')$$, 'BC002');

-- Dedicated two-unit vehicle for the one-way and chain tests (both units start at branch 1).
insert into vehicles (id, slug, name, brand, category, price_per_day, transmission, fuel, image_url) values
  ('44444444-4444-4444-4444-444444444444', 'oneway-car', 'One Way Car', 'Test', 'popular', 50, 'automatic', 'petrol', 'http://x/i.jpg');
insert into fleet_units (provider_id, branch_id, vehicle_id, plate) values
  ('00000000-0000-0000-0000-00000000b0c1', 1, '44444444-4444-4444-4444-444444444444', 'OW-1'),
  ('00000000-0000-0000-0000-00000000b0c1', 1, '44444444-4444-4444-4444-444444444444', 'OW-2');

-- One-way: a unit moves to the drop-off branch when the booking completes.
select create_booking_atomic('44444444-4444-4444-4444-444444444444', 1, 2, '2030-06-01 10:00+00', '2030-06-03 10:00+00', 'K', 'k@example.com', 50, 'BC-T00012');
select transition_booking(id, 'confirmed') from bookings where reference = 'BC-T00012';
select transition_booking(id, 'active') from bookings where reference = 'BC-T00012';
select transition_booking(id, 'completed') from bookings where reference = 'BC-T00012';
select test.assert((select u.branch_id from fleet_units u join bookings b on b.fleet_unit_id = u.id where b.reference = 'BC-T00012') = 2, 'completed one-way moves the unit to the drop-off branch');
select create_booking_atomic('44444444-4444-4444-4444-444444444444', 1, 1, '2030-06-10 10:00+00', '2030-06-11 10:00+00', 'L', 'l@example.com', 50, 'BC-T00013');
select test.assert((select fleet_unit_id from bookings where reference = 'BC-T00013') <> (select fleet_unit_id from bookings where reference = 'BC-T00012'), 'a later round trip at branch 1 uses the other unit');

-- One-way with a still-pending booking: the unit is treated as being at the drop-off branch afterwards.
select create_booking_atomic('44444444-4444-4444-4444-444444444444', 1, 2, '2030-07-01 10:00+00', '2030-07-03 10:00+00', 'M', 'm@example.com', 50, 'BC-T00014');
select test.assert((select unit_branch_at(fleet_unit_id, '2030-07-10 10:00+00') from bookings where reference = 'BC-T00014') = 2, 'unit_branch_at follows pending one-way bookings');

-- Chain check: both units are now at branch 2. A unit whose next booking starts at branch 2
-- cannot be sent one-way to branch 1 before it.
select create_booking_atomic('44444444-4444-4444-4444-444444444444', 2, 2, '2030-08-10 10:00+00', '2030-08-12 10:00+00', 'N', 'n@example.com', 50, 'BC-T00015');
select create_booking_atomic('44444444-4444-4444-4444-444444444444', 2, 1, '2030-08-01 10:00+00', '2030-08-03 10:00+00', 'O', 'o@example.com', 50, 'BC-T00016');
select test.assert((select fleet_unit_id from bookings where reference = 'BC-T00016') <> (select fleet_unit_id from bookings where reference = 'BC-T00015'), 'one-way avoids the unit that is needed at branch 2 afterwards');

-- Released units can be booked again.
select transition_booking(id, 'cancelled') from bookings where reference = 'BC-T00002';
select create_booking_atomic('11111111-1111-1111-1111-111111111111', 1, 1, '2030-03-01 10:00+00', '2030-03-03 10:00+00', 'P', 'p@example.com', 96, 'BC-T00017');

-- Only the service role may call the engine.
select test.assert(not has_function_privilege('anon', 'create_booking_atomic(uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text,numeric,text,text,text,text,uuid,uuid,jsonb)', 'execute'), 'anon cannot execute create_booking_atomic');
select test.assert(has_function_privilege('service_role', 'create_booking_atomic(uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text,numeric,text,text,text,text,uuid,uuid,jsonb)', 'execute'), 'service_role can execute create_booking_atomic');
