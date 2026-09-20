-- Backfill from the legacy stock counter (greatest(stock, 1) units per vehicle).
select test.assert((select count(*) from fleet_units where vehicle_id = '11111111-1111-1111-1111-111111111111') = 2, 'civic: stock 2 becomes 2 units');
select test.assert((select count(*) from fleet_units where vehicle_id = '22222222-2222-2222-2222-222222222222') = 1, 'tahoe: stock 0 still gets one unit');
select test.assert((select branch_id from fleet_units where vehicle_id = '33333333-3333-3333-3333-333333333333') = 1, 'vehicle without a location falls back to the first branch');
select test.assert((select stock from vehicles where id = '22222222-2222-2222-2222-222222222222') = 1, 'stock is synced to the active unit count');

-- Stock follows unit inserts and status changes.
insert into fleet_units (id, provider_id, branch_id, vehicle_id, plate) values
  ('dddddddd-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000b0c1', 1, '11111111-1111-1111-1111-111111111111', 'T-1'),
  ('dddddddd-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000b0c1', 1, '11111111-1111-1111-1111-111111111111', 'T-2');
select test.assert((select stock from vehicles where id = '11111111-1111-1111-1111-111111111111') = 4, 'inserting units raises stock');
update fleet_units set status = 'retired' where id = 'dddddddd-0000-0000-0000-000000000001';
select test.assert((select stock from vehicles where id = '11111111-1111-1111-1111-111111111111') = 3, 'retiring a unit lowers stock');

-- A unit cannot point at a branch that does not exist for its provider.
select test.expect_error($$insert into fleet_units (provider_id, branch_id, vehicle_id, plate) values ('00000000-0000-0000-0000-00000000b0c1', 99999, '11111111-1111-1111-1111-111111111111', 'BAD')$$, '23503');

-- Occupancy: overlapping ranges on one unit are impossible; back-to-back is fine.
insert into unit_occupancy (fleet_unit_id, provider_id, reason, during) values
  ('dddddddd-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000b0c1', 'maintenance', tstzrange('2030-01-10 00:00+00', '2030-01-12 00:00+00', '[)'));
select test.expect_error($$insert into unit_occupancy (fleet_unit_id, provider_id, reason, during) values ('dddddddd-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000b0c1', 'maintenance', tstzrange('2030-01-11 00:00+00', '2030-01-13 00:00+00', '[)'))$$, '23P01');
insert into unit_occupancy (fleet_unit_id, provider_id, reason, during) values
  ('dddddddd-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000b0c1', 'maintenance', tstzrange('2030-01-12 00:00+00', '2030-01-14 00:00+00', '[)'));

-- Occupancy row integrity.
select test.expect_error($$insert into unit_occupancy (fleet_unit_id, provider_id, reason, during) values ('dddddddd-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000b0c1', 'booking', tstzrange('2030-02-01 00:00+00', '2030-02-02 00:00+00', '[)'))$$, '23514');
select test.expect_error($$insert into unit_occupancy (fleet_unit_id, provider_id, reason, during) values ('dddddddd-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000009', 'maintenance', tstzrange('2030-02-01 00:00+00', '2030-02-02 00:00+00', '[)'))$$, '23503');
select test.expect_error($$insert into unit_occupancy (fleet_unit_id, provider_id, reason, during) values ('dddddddd-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000b0c1', 'maintenance', tstzrange('2030-02-01 00:00+00', null, '[)'))$$, '23514');

-- Availability windows may not overlap and may not be empty.
insert into availability_windows (fleet_unit_id, provider_id, during) values
  ('dddddddd-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000b0c1', tstzrange('2030-03-01 00:00+00', '2030-03-10 00:00+00', '[)'));
select test.expect_error($$insert into availability_windows (fleet_unit_id, provider_id, during) values ('dddddddd-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000b0c1', tstzrange('2030-03-05 00:00+00', '2030-03-12 00:00+00', '[)'))$$, '23P01');
select test.expect_error($$insert into availability_windows (fleet_unit_id, provider_id, during) values ('dddddddd-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000b0c1', tstzrange('2030-04-01 00:00+00', '2030-04-01 00:00+00', '[)'))$$, '23514');

-- RLS: managers read and write their provider's units, agents read only, strangers see nothing.
insert into auth.users (id) values ('cccccccc-0000-0000-0000-0000000000a1'), ('cccccccc-0000-0000-0000-0000000000a2');
insert into provider_members (provider_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000b0c1', 'cccccccc-0000-0000-0000-0000000000a1', 'manager'),
  ('00000000-0000-0000-0000-00000000b0c1', 'cccccccc-0000-0000-0000-0000000000a2', 'agent');

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select test.assert((select count(*) from fleet_units) >= 4, 'manager reads the provider units');
update fleet_units set mileage_km = 10 where id = 'dddddddd-0000-0000-0000-000000000002';
select test.assert((select mileage_km from fleet_units where id = 'dddddddd-0000-0000-0000-000000000002') = 10, 'manager can update a unit');
reset role;

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000a2', true);
set local role authenticated;
select test.assert((select count(*) from fleet_units) >= 4, 'agent reads units');
update fleet_units set mileage_km = 99 where id = 'dddddddd-0000-0000-0000-000000000002';
select test.assert((select mileage_km from fleet_units where id = 'dddddddd-0000-0000-0000-000000000002') = 10, 'agent cannot update a unit');
reset role;

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000ff', true);
set local role authenticated;
select test.assert((select count(*) from fleet_units) = 0, 'a stranger sees no units');
select test.assert((select count(*) from unit_occupancy) = 0, 'a stranger sees no occupancy');
reset role;
