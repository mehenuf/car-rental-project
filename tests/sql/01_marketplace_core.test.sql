-- Backfill: default provider + one branch per legacy location, same ids.
select test.assert((select count(*) from providers where id = '00000000-0000-0000-0000-00000000b0c1' and status = 'approved') = 1, 'default provider is seeded and approved');
select test.assert((select count(*) from branches) = 2, 'one branch per legacy location');
select test.assert((select city from branches where id = 1) = 'Dubai', 'branch ids mirror location ids');
select test.assert((select nextval(pg_get_serial_sequence('branches', 'id'))) > 2, 'branch id sequence moved past the copied ids');

-- Fixtures for the RLS checks.
insert into providers (id, type, legal_name, display_name, country_code, default_currency, status) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'individual', 'Jo Owner', 'Jo', 'US', 'USD', 'draft');
insert into auth.users (id) values
  ('cccccccc-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000002');
insert into provider_members (provider_id, user_id, role) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001', 'owner');
insert into branches (id, provider_id, code, name, city, country, country_code, currency) values
  (900, 'bbbbbbbb-0000-0000-0000-000000000002', 'JO-1', 'Jo Garage', 'Austin', 'United States', 'US', 'USD');

-- A member scoped to another provider's branch is rejected (composite FK).
select test.expect_error($$insert into provider_members (provider_id, user_id, role, branch_id) values ('bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000002', 'manager', 1)$$, '23503');

-- Anonymous: only branches of approved providers, no provider rows.
set local role anon;
select test.assert((select count(*) from branches) = 2, 'anon sees only branches of approved providers');
select test.assert((select count(*) from providers) = 0, 'anon cannot read providers directly');
reset role;

-- A member also sees their own unapproved provider, and cannot write to someone else's.
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000001', true);
set local role authenticated;
select test.assert((select count(*) from branches) = 3, 'member sees approved branches plus their own');
select test.assert((select count(*) from providers) = 1, 'member sees only their own provider');
select test.assert((select count(*) from provider_members) = 1, 'member sees their own membership');
select test.expect_error($$insert into branches (provider_id, code, name, city, country, country_code, currency) values ('00000000-0000-0000-0000-00000000b0c1', 'ZZ', 'Hack', 'X', 'Y', 'US', 'USD')$$, '42501');
reset role;

-- A non-member sees only approved branches and no memberships.
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000002', true);
set local role authenticated;
select test.assert((select count(*) from branches) = 2, 'non-member sees only approved branches');
select test.assert((select count(*) from provider_members) = 0, 'non-member sees no memberships');
reset role;
