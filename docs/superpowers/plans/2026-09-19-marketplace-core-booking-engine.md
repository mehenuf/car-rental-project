# Marketplace Core and Booking Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-company `stock` counter with a multi-provider data model (providers, branches, fleet units) and a database-enforced, date-based availability and booking engine, and switch the site, API and admin to it.

**Architecture:** Postgres owns the invariants. An exclusion constraint on `unit_occupancy` makes double-booking impossible, and plpgsql functions (`free_units`, `create_booking_atomic`, `transition_booking`) hold the booking logic. Next.js route handlers call those functions through the service-role client. Legacy `locations` become `branches` under a seeded default provider, so existing ids, slugs and URLs keep working. Legacy objects are removed only in the final "contract" migration.

**Tech Stack:** Postgres 15 (Supabase), plpgsql, `btree_gist`, Next.js 16, TypeScript (strict, `noUncheckedIndexedAccess`), Zod 4, vitest (new), `pg` (new, test runner only).

**Spec:** `docs/superpowers/specs/2026-09-19-marketplace-platform-design.md` (sections 3 and 5b). Pricing (section 4) is sub-project 2. Prices stay `price_per_day × days` here.

## Global Constraints

- Next.js 16 has breaking changes. `AGENTS.md` requires reading the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code. Follow the existing route-handler and page patterns in this repo (`params` and `searchParams` are Promises).
- Zod validates every API input. Privileged DB access only through `supabaseAdmin` (`server-only`).
- Availability is enforced by the database exclusion constraint, never by app-level read-then-write.
- Booking error codes (SQLSTATE): `BC001` illegal status transition, `BC002` no vehicle available, `BC003` unknown branch, `BC004` invalid date range. `P0002` booking not found.
- Booking statuses: `pending`, `confirmed`, `active`, `completed`, `cancelled`, `no_show`. Revenue statuses: `confirmed`, `active`, `completed`.
- Every provider-scoped table carries `provider_id`, with a composite foreign key so a row can never point at another provider's branch or unit.
- One-way rentals stay within one provider.
- Default provider id (seeded, approved): `00000000-0000-0000-0000-00000000b0c1`.
- The SQL test runner drops schema `public`. It must only ever run against a scratch database.
- Do not apply migrations 0003 to 0007 to production until the rollout runbook in Task 9.
- TypeScript checks: `npx tsc --noEmit` and `npm run lint` must pass at the end of every task that touches `.ts` or `.tsx`.
- End every commit message with these two lines:
  - `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
  - `Claude-Session: https://claude.ai/code/session_01MY3masm7BT8kyzz4crjTUs`

## File Structure

| File | Responsibility |
|---|---|
| `vitest.config.ts` | Unit test config with the `@` alias |
| `scripts/run-sql-tests.ts` | Rebuilds a scratch Postgres from `schema.sql` plus migrations and runs SQL tests |
| `tests/sql/00_auth_stub.sql`, `00_helpers.sql` | Supabase `auth` and role stand-ins, `test.assert`, `test.expect_error` |
| `tests/sql/fixtures/pre_0003.sql` | Legacy data loaded before migration 0003 so backfills are tested |
| `tests/sql/NN_*.test.sql` | SQL tests, one file per topic |
| `migrations/0003_marketplace_core.sql` | providers, provider_members, branches, RLS |
| `migrations/0004_fleet_and_occupancy.sql` | fleet_units, availability_windows, unit_occupancy, stock sync |
| `migrations/0005_booking_lifecycle.sql` | booking columns, new statuses, views, `transition_booking` |
| `migrations/0006_booking_functions.sql` | `unit_branch_at`, `free_units`, `available_vehicle_ids`, `create_booking_atomic`, backfill |
| `migrations/0007_contract_legacy.sql` | drops `locations`, old stock RPCs, old booking columns |
| `src/lib/booking-state.ts` | TypeScript mirror of the status machine and labels |
| `src/lib/booking-errors.ts` | Maps booking RPC errors to API errors |
| `src/types/database.ts` | Hand-written DB types (extended) |

---

### Task 1: Test tooling

**Files:**
- Create: `vitest.config.ts`, `scripts/run-sql-tests.ts`, `tests/sql/00_auth_stub.sql`, `tests/sql/00_helpers.sql`
- Modify: `package.json`

**Interfaces:**
- Produces: `npm test` (vitest, `src/**/*.test.ts`), `npm run test:db [-- <file prefix>]` (SQL tests). Helpers `test.assert(cond boolean, msg text)` and `test.expect_error(sql text, sqlstate text)`. The runner applies `tests/sql/fixtures/pre_NNNN.sql` immediately before `migrations/NNNN_*.sql` when present.

- [ ] **Step 1: Install dev dependencies**

Run: `npm install -D vitest@3 pg @types/pg` (vitest 5 needs `@types/node` 22+, this project pins 20)
Expected: installs without errors.

- [ ] **Step 2: Add scripts to `package.json`**

In `"scripts"` add:
```json
    "test": "vitest run",
    "test:db": "tsx scripts/run-sql-tests.ts"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
```

- [ ] **Step 4: Create `tests/sql/00_auth_stub.sql`** (stands in for Supabase's `auth` schema and roles on plain Postgres)

```sql
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
```

- [ ] **Step 5: Create `tests/sql/00_helpers.sql`**

```sql
create schema test;
grant usage on schema test to public;

create function test.assert(p_cond boolean, p_msg text) returns void
language plpgsql as $$
begin
  if p_cond is not true then
    raise exception 'ASSERT FAILED: %', p_msg;
  end if;
end $$;

-- Runs p_sql and requires it to fail with exactly p_sqlstate.
create function test.expect_error(p_sql text, p_sqlstate text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_sqlstate then return; end if;
    raise exception 'expected SQLSTATE %, got % (%) for: %', p_sqlstate, sqlstate, sqlerrm, p_sql;
  end;
  raise exception 'expected SQLSTATE % but statement succeeded: %', p_sqlstate, p_sql;
end $$;
```

- [ ] **Step 6: Create `scripts/run-sql-tests.ts`**

```ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error("Set TEST_DATABASE_URL to a SCRATCH Postgres, e.g. postgres://postgres:postgres@localhost:5432/bc_test");
  process.exit(1);
}
const host = new URL(url).hostname;
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && process.env.ALLOW_REMOTE_TEST_DB !== "1") {
  console.error(`Refusing to run: this script DROPS schema public and "${host}" is not local. Set ALLOW_REMOTE_TEST_DB=1 to override.`);
  process.exit(1);
}

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), "utf8");
const filter = process.argv[2] ?? "";

async function main() {
  const client = new Client({ connectionString: url });
  await client.connect();

  await client.query("drop schema if exists test cascade; drop schema if exists auth cascade; drop schema public cascade; create schema public;");
  await client.query(read("tests", "sql", "00_auth_stub.sql"));
  await client.query(read("tests", "sql", "00_helpers.sql"));
  await client.query(read("schema.sql"));

  const migrations = readdirSync(join(root, "migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const file of migrations) {
    const num = file.slice(0, 4);
    const fixture = join("tests", "sql", "fixtures", `pre_${num}.sql`);
    if (existsSync(join(root, fixture))) await client.query(read(fixture));
    await client.query(read("migrations", file));
    console.log(`applied ${file}`);
  }

  const tests = readdirSync(join(root, "tests", "sql"))
    .filter((f) => /^\d+_.*\.test\.sql$/.test(f) && f.startsWith(filter))
    .sort();
  let failed = 0;
  for (const file of tests) {
    try {
      await client.query("begin");
      await client.query(read("tests", "sql", file));
      console.log(`PASS ${file}`);
    } catch (err) {
      failed++;
      console.error(`FAIL ${file}\n  ${(err as Error).message}`);
    } finally {
      await client.query("rollback");
    }
  }
  await client.end();
  console.log(`\n${tests.length - failed}/${tests.length} SQL test files passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 7: Start a scratch Postgres and verify the runner works with no tests yet**

Run: `docker run -d --name bc-test-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bc_test -p 5432:5432 postgres:16`
Then (bash): `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/bc_test npm run test:db`
Expected: `applied 0001_...`, `applied 0002_...`, then `0/0 SQL test files passed`, exit code 0.
(PowerShell: `$env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:5432/bc_test"; npm run test:db`.)

- [ ] **Step 8: Verify vitest runs**

Run: `npx vitest run`
Expected: "No test files found" (exit 1 is fine at this point).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vitest.config.ts scripts tests
git commit -m "Add vitest and a SQL test runner for the marketplace work"
```

---

### Task 2: Providers, members and branches (migration 0003)

**Files:**
- Create: `tests/sql/fixtures/pre_0003.sql`, `tests/sql/01_marketplace_core.test.sql`, `migrations/0003_marketplace_core.sql`

**Interfaces:**
- Produces tables `providers(id, type, legal_name, display_name, country_code, default_currency, status, commission_rate_override, created_at)`, `provider_members(provider_id, user_id, role, branch_id)`, `branches(id serial, provider_id, code, name, city, country, country_code, address, timezone, currency, turnaround_minutes, opening_hours, is_active)`. Both `branches` and `provider_members` are keyed so `(id, provider_id)` and `(branch_id, provider_id)` are enforceable. Functions `is_provider_member(provider_id uuid, roles text[] default all roles)` and `is_provider_approved(provider_id uuid)`. The seeded default provider exists, and `branches.id` equals the legacy `locations.id`.

- [ ] **Step 1: Create the legacy fixture `tests/sql/fixtures/pre_0003.sql`**

```sql
-- Legacy (pre-marketplace) data, loaded before migration 0003 so the backfills are tested.
insert into locations (id, city, country, country_code) values
  (1, 'Dubai', 'United Arab Emirates', 'AE'),
  (2, 'Austin', 'United States', 'US');
select setval(pg_get_serial_sequence('locations', 'id'), 2);

insert into vehicles (id, slug, name, brand, category, price_per_day, transmission, fuel, image_url, stock, location_id) values
  ('11111111-1111-1111-1111-111111111111', 'civic', 'Honda Civic', 'Honda', 'popular', 48, 'automatic', 'petrol', 'http://x/i.jpg', 2, 1),
  ('22222222-2222-2222-2222-222222222222', 'tahoe', 'Chevy Tahoe', 'Chevrolet', 'large', 99, 'automatic', 'petrol', 'http://x/i.jpg', 0, 2),
  ('33333333-3333-3333-3333-333333333333', 'mini', 'Mini Cooper', 'Mini', 'small', 60, 'manual', 'petrol', 'http://x/i.jpg', 1, null);

insert into bookings (id, reference, vehicle_id, customer_name, email, pickup_location_id, dropoff_location_id, pickup_at, dropoff_at, total_amount, status) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'BC-000001', '11111111-1111-1111-1111-111111111111', 'Past Paid',   'a@example.com', 1, 1, '2026-01-10 10:00+00', '2026-01-12 10:00+00', 96, 'success'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'BC-000002', '11111111-1111-1111-1111-111111111111', 'Future Paid', 'b@example.com', 1, 1, now() + interval '10 days', now() + interval '12 days', 96, 'success'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'BC-000003', '11111111-1111-1111-1111-111111111111', 'Cancelled',   'c@example.com', 1, 1, now() + interval '3 days', now() + interval '4 days', 48, 'cancelled'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'BC-000004', '33333333-3333-3333-3333-333333333333', 'Pending',     'd@example.com', null, null, now() + interval '5 days', now() + interval '6 days', 60, 'pending');
```

- [ ] **Step 2: Write the failing test `tests/sql/01_marketplace_core.test.sql`**

```sql
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
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run test:db -- 01`
Expected: `FAIL 01_marketplace_core.test.sql` with `relation "providers" does not exist`.

- [ ] **Step 4: Create `migrations/0003_marketplace_core.sql`**

```sql
-- Marketplace core: providers, staff membership, branches (replaces locations).
-- Expand step only: `locations` and the old columns keep working until 0007.

create extension if not exists btree_gist;

create table providers (
  id                       uuid primary key default gen_random_uuid(),
  type                     text not null check (type in ('company', 'individual')),
  legal_name               text not null,
  display_name             text not null,
  country_code             char(2) not null,
  default_currency         char(3) not null,
  status                   text not null default 'draft'
                             check (status in ('draft','submitted','under_review','approved','rejected','suspended')),
  commission_rate_override numeric(5,4) check (commission_rate_override between 0 and 1),
  created_at               timestamptz not null default now()
);

create table branches (
  id                 serial primary key,
  provider_id        uuid not null references providers(id) on delete cascade,
  code               text not null,
  name               text not null,
  city               text not null,
  country            text not null,
  country_code       char(2) not null,
  address            text,
  timezone           text not null default 'UTC',
  currency           char(3) not null,
  turnaround_minutes int not null default 60 check (turnaround_minutes >= 0),
  opening_hours      jsonb,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  unique (id, provider_id),
  unique (provider_id, code)
);

create table provider_members (
  provider_id uuid not null references providers(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('owner', 'manager', 'agent')),
  branch_id   int,  -- optional branch scope for managers; null = all branches
  created_at  timestamptz not null default now(),
  primary key (provider_id, user_id),
  foreign key (branch_id, provider_id) references branches (id, provider_id) on delete cascade
);

create index branches_provider_idx on branches(provider_id);
create index provider_members_user_idx on provider_members(user_id);

-- ---------------------------------------------------------------
-- Backfill: one default approved provider; every legacy location becomes
-- one of its branches with the SAME id, so existing location ids in URLs,
-- vehicles.location_id and bookings stay valid.
-- ---------------------------------------------------------------
insert into providers (id, type, legal_name, display_name, country_code, default_currency, status)
values ('00000000-0000-0000-0000-00000000b0c1', 'company', 'BestCar Rentals Ltd', 'BestCar', 'US', 'USD', 'approved');

insert into branches (id, provider_id, code, name, city, country, country_code, currency)
select l.id, '00000000-0000-0000-0000-00000000b0c1', upper(l.country_code) || '-' || l.id,
       l.city || ' Branch', l.city, l.country, l.country_code, 'USD'
from locations l;

select setval(pg_get_serial_sequence('branches', 'id'), coalesce((select max(id) from branches), 0) + 1, false);

-- ---------------------------------------------------------------
-- Access helpers (security definer so policies can consult tables the
-- caller cannot read directly, without recursive policy evaluation).
-- ---------------------------------------------------------------
create or replace function is_provider_member(
  p_provider_id uuid,
  p_roles text[] default array['owner', 'manager', 'agent']
) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from provider_members m
    where m.provider_id = p_provider_id and m.user_id = auth.uid() and m.role = any (p_roles)
  );
$$;

create or replace function is_provider_approved(p_provider_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from providers p where p.id = p_provider_id and p.status = 'approved');
$$;

-- ---------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------
alter table providers        enable row level security;
alter table branches         enable row level security;
alter table provider_members enable row level security;

create policy "members read own provider" on providers
  for select using (is_provider_member(id));

create policy "public read active branches of approved providers" on branches
  for select using (is_active and is_provider_approved(provider_id));
create policy "members read own branches" on branches
  for select using (is_provider_member(provider_id));
create policy "owners and managers write branches" on branches
  for all using (is_provider_member(provider_id, array['owner', 'manager']))
  with check (is_provider_member(provider_id, array['owner', 'manager']));

create policy "read own membership or as provider owner" on provider_members
  for select using (user_id = auth.uid() or is_provider_member(provider_id, array['owner']));
create policy "owners manage members" on provider_members
  for all using (is_provider_member(provider_id, array['owner']))
  with check (is_provider_member(provider_id, array['owner']));
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:db -- 01`
Expected: `PASS 01_marketplace_core.test.sql`, `1/1 SQL test files passed`.

- [ ] **Step 6: Commit**

```bash
git add migrations/0003_marketplace_core.sql tests/sql
git commit -m "Add providers, members and branches with RLS (migration 0003)"
```

---

### Task 3: Fleet units, availability windows and occupancy (migration 0004)

**Files:**
- Create: `tests/sql/02_fleet_units.test.sql`, `migrations/0004_fleet_and_occupancy.sql`

**Interfaces:**
- Consumes: `providers`, `branches` (Task 2), the legacy `vehicles` and `bookings` tables.
- Produces:
  - `fleet_units(id, provider_id, branch_id, vehicle_id, plate, vin, mileage_km, status active|maintenance|retired, requires_window)`
  - `availability_windows(id, fleet_unit_id, provider_id, during tstzrange)`
  - `unit_occupancy(id, fleet_unit_id, provider_id, reason booking|maintenance|transfer|owner_block, booking_id, during tstzrange)`
  - An exclusion constraint that prevents overlapping `during` ranges per unit. `vehicles.stock` is kept equal to the number of active units by a trigger. `vehicles.stock` now defaults to 0.

- [ ] **Step 1: Write the failing test `tests/sql/02_fleet_units.test.sql`**

```sql
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:db -- 02`
Expected: `FAIL 02_fleet_units.test.sql` with `relation "fleet_units" does not exist`.

- [ ] **Step 3: Create `migrations/0004_fleet_and_occupancy.sql`**

```sql
-- Physical fleet, owner availability windows and the occupancy table whose
-- exclusion constraint makes double-booking impossible. `vehicles` stays as
-- the model catalogue (slugs and URLs unchanged); `stock` becomes a derived
-- count of active units.

create table fleet_units (
  id              uuid primary key default gen_random_uuid(),
  provider_id     uuid not null,
  branch_id       int  not null,
  vehicle_id      uuid not null references vehicles(id) on delete cascade,
  plate           text not null,
  vin             text,
  mileage_km      int  not null default 0 check (mileage_km >= 0),
  status          text not null default 'active' check (status in ('active', 'maintenance', 'retired')),
  requires_window boolean not null default false,  -- true for individual-owner cars bookable only inside availability windows
  created_at      timestamptz not null default now(),
  foreign key (branch_id, provider_id) references branches (id, provider_id),
  unique (id, provider_id),
  unique (provider_id, plate)
);
create index fleet_units_vehicle_idx on fleet_units(vehicle_id, branch_id) where status = 'active';

create table availability_windows (
  id            uuid primary key default gen_random_uuid(),
  fleet_unit_id uuid not null,
  provider_id   uuid not null,
  during        tstzrange not null
    check (not isempty(during) and lower(during) is not null and upper(during) is not null
           and lower_inc(during) and not upper_inc(during)),
  foreign key (fleet_unit_id, provider_id) references fleet_units (id, provider_id) on delete cascade,
  exclude using gist (fleet_unit_id with =, during with &&)
);

create table unit_occupancy (
  id            uuid primary key default gen_random_uuid(),
  fleet_unit_id uuid not null,
  provider_id   uuid not null,
  reason        text not null check (reason in ('booking', 'maintenance', 'transfer', 'owner_block')),
  booking_id    uuid references bookings(id) on delete cascade,
  -- For bookings the range already includes the drop-off branch turnaround buffer.
  during        tstzrange not null
    check (not isempty(during) and lower(during) is not null and upper(during) is not null
           and lower_inc(during) and not upper_inc(during)),
  created_at    timestamptz not null default now(),
  foreign key (fleet_unit_id, provider_id) references fleet_units (id, provider_id) on delete cascade,
  check ((reason = 'booking') = (booking_id is not null)),
  exclude using gist (fleet_unit_id with =, during with &&)
);
create index unit_occupancy_booking_idx on unit_occupancy(booking_id);

-- New catalogue rows start with no fleet; units are added explicitly.
alter table vehicles alter column stock set default 0;

-- stock = number of active units of the vehicle.
create or replace function sync_vehicle_stock() returns trigger
language plpgsql as $$
declare v uuid;
begin
  for v in
    select distinct x
    from unnest(array[
      case when tg_op <> 'INSERT' then old.vehicle_id end,
      case when tg_op <> 'DELETE' then new.vehicle_id end
    ]) as x
    where x is not null
  loop
    update vehicles
    set stock = (select count(*) from fleet_units u where u.vehicle_id = v and u.status = 'active')
    where id = v;
  end loop;
  return null;
end $$;

create trigger fleet_units_sync_stock
  after insert or update or delete on fleet_units
  for each row execute function sync_vehicle_stock();

-- Backfill: one unit per unit of legacy stock (at least one), at the vehicle
-- location, falling back to the first branch.
insert into fleet_units (provider_id, branch_id, vehicle_id, plate)
select b.provider_id, b.id, v.id,
       'BC-' || upper(substr(replace(v.id::text, '-', ''), 1, 4)) || '-' || n
from vehicles v
join branches b on b.id = coalesce(v.location_id, (select min(id) from branches))
cross join lateral generate_series(1, greatest(v.stock, 1)) n;

-- RLS
alter table fleet_units          enable row level security;
alter table availability_windows enable row level security;
alter table unit_occupancy       enable row level security;

create policy "members read units" on fleet_units
  for select using (is_provider_member(provider_id));
create policy "owners and managers write units" on fleet_units
  for all using (is_provider_member(provider_id, array['owner', 'manager']))
  with check (is_provider_member(provider_id, array['owner', 'manager']));

create policy "members read windows" on availability_windows
  for select using (is_provider_member(provider_id));
create policy "owners and managers write windows" on availability_windows
  for all using (is_provider_member(provider_id, array['owner', 'manager']))
  with check (is_provider_member(provider_id, array['owner', 'manager']));

-- Occupancy is written only by the booking functions (service role).
create policy "members read occupancy" on unit_occupancy
  for select using (is_provider_member(provider_id));
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:db -- 0`
Expected: `PASS 01_marketplace_core.test.sql` and `PASS 02_fleet_units.test.sql`.

- [ ] **Step 5: Commit**

```bash
git add migrations/0004_fleet_and_occupancy.sql tests/sql
git commit -m "Add fleet units, availability windows and occupancy with an exclusion constraint (migration 0004)"
```

---

### Task 4: Booking lifecycle, statuses and views (migration 0005)

**Files:**
- Create: `tests/sql/03_booking_lifecycle.test.sql`, `migrations/0005_booking_lifecycle.sql`

**Interfaces:**
- Consumes: `branches` (Task 2), `fleet_units` and `unit_occupancy` (Task 3).
- Produces:
  - New `bookings` columns `provider_id`, `fleet_unit_id`, `pickup_branch_id`, `dropoff_branch_id`, `currency`.
  - Status check `('pending','confirmed','active','completed','cancelled','no_show')`. Legacy `success` becomes `completed` when the drop-off is in the past, otherwise `confirmed`.
  - `transition_booking(p_booking_id uuid, p_to text) returns bookings`. It raises `BC001` for an illegal transition and `P0002` if the booking is missing. Cancelling or marking no-show deletes the booking's occupancy. Completing moves the unit to the drop-off branch.
  - Views and `refresh_daily_stats` count revenue for `confirmed`, `active` and `completed`. `v_sales_by_country` joins `branches`.

- [ ] **Step 1: Write the failing test `tests/sql/03_booking_lifecycle.test.sql`**

```sql
-- Legacy status mapping.
select test.assert((select status from bookings where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'completed', 'past success -> completed');
select test.assert((select status from bookings where id = 'aaaaaaaa-0000-0000-0000-000000000002') = 'confirmed', 'future success -> confirmed');
select test.assert((select status from bookings where id = 'aaaaaaaa-0000-0000-0000-000000000003') = 'cancelled', 'cancelled stays cancelled');
select test.assert((select status from bookings where id = 'aaaaaaaa-0000-0000-0000-000000000004') = 'pending', 'pending stays pending');
select test.expect_error($$update bookings set status = 'success' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, '23514');

-- Column backfill from the legacy location ids.
select test.assert((select pickup_branch_id from bookings where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 1, 'pickup_branch_id copied from pickup_location_id');
select test.assert((select currency from bookings where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'USD', 'currency backfilled');
select test.assert((select provider_id from bookings where id = 'aaaaaaaa-0000-0000-0000-000000000001') = '00000000-0000-0000-0000-00000000b0c1', 'provider backfilled');

-- Revenue views count confirmed/active/completed only (civic: completed + confirmed + cancelled).
select test.assert((select sales_count from v_best_sellers where id = '11111111-1111-1111-1111-111111111111') = 2, 'best sellers count revenue statuses');
select test.assert((select sales_count from v_sales_by_country where country_code = 'AE') = 2, 'sales by country joins branches');

-- The full transition matrix (mirror of src/lib/booking-state.ts).
do $$
declare
  s text; t text; n int := 0; bid uuid;
  legal text[] := array['pending>confirmed','pending>cancelled','confirmed>active','confirmed>cancelled','confirmed>no_show','active>completed'];
begin
  foreach s in array array['pending','confirmed','active','completed','cancelled','no_show'] loop
    foreach t in array array['pending','confirmed','active','completed','cancelled','no_show'] loop
      n := n + 1;
      bid := gen_random_uuid();
      insert into bookings (id, reference, customer_name, email, pickup_at, dropoff_at, total_amount, status)
      values (bid, 'BC-M' || lpad(n::text, 5, '0'), 'Matrix', 'm@example.com', now() + interval '1 day', now() + interval '2 days', 1, s);
      if (s || '>' || t) = any (legal) then
        perform transition_booking(bid, t);
        if (select status from bookings where id = bid) <> t then
          raise exception 'matrix: % -> % did not apply', s, t;
        end if;
      else
        perform test.expect_error(format('select transition_booking(%L, %L)', bid, t), 'BC001');
      end if;
    end loop;
  end loop;
end $$;

select test.expect_error($$select transition_booking('99999999-9999-9999-9999-999999999999', 'confirmed')$$, 'P0002');
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:db -- 03`
Expected: `FAIL 03_booking_lifecycle.test.sql` (for example `column "provider_id" does not exist`).

- [ ] **Step 3: Create `migrations/0005_booking_lifecycle.sql`**

```sql
-- Booking lifecycle: marketplace columns, the six-state status machine, revenue
-- views and the single transition function. Old location columns stay until 0007.

alter table bookings
  add column provider_id        uuid references providers(id),
  add column fleet_unit_id      uuid references fleet_units(id) on delete set null,
  add column pickup_branch_id   int  references branches(id),
  add column dropoff_branch_id  int  references branches(id),
  add column currency           char(3);

create index bookings_provider_idx on bookings(provider_id);
create index bookings_unit_idx     on bookings(fleet_unit_id, pickup_at);

-- Location ids and branch ids are identical (see 0003).
update bookings
set pickup_branch_id  = pickup_location_id,
    dropoff_branch_id = dropoff_location_id,
    provider_id       = '00000000-0000-0000-0000-00000000b0c1',
    currency          = 'USD';

-- Statuses: drop the old check first, then remap, then add the new one.
alter table bookings drop constraint if exists bookings_status_check;
update bookings set status = 'completed' where status = 'success' and dropoff_at < now();
update bookings set status = 'confirmed' where status = 'success';
alter table bookings add constraint bookings_status_check
  check (status in ('pending', 'confirmed', 'active', 'completed', 'cancelled', 'no_show'));

-- Revenue-counting statuses: confirmed, active, completed.
create or replace view v_best_sellers as
select v.id, v.name, v.brand, v.image_url, v.price_per_day,
       count(b.id) as sales_count,
       coalesce(sum(b.total_amount), 0) as revenue
from vehicles v
left join bookings b on b.vehicle_id = v.id and b.status in ('confirmed', 'active', 'completed')
group by v.id
order by sales_count desc;

create or replace view v_sales_by_country as
select br.country, br.country_code,
       count(b.id) as sales_count,
       coalesce(sum(b.total_amount), 0) as revenue
from bookings b
join branches br on br.id = b.pickup_branch_id
where b.status in ('confirmed', 'active', 'completed')
group by br.country, br.country_code
order by sales_count desc;

create or replace function refresh_daily_stats() returns void as $$
begin
  delete from daily_stats;
  insert into daily_stats (date, revenue, sales_count, purchases)
  select date_trunc('day', created_at)::date,
         sum(total_amount) filter (where status in ('confirmed', 'active', 'completed')),
         count(*) filter (where status in ('confirmed', 'active', 'completed')),
         count(*)
  from bookings
  group by 1;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------
-- The one place statuses change. Mirrored by src/lib/booking-state.ts.
-- Errors: P0002 booking not found, BC001 illegal transition.
-- ---------------------------------------------------------------
create or replace function transition_booking(p_booking_id uuid, p_to text)
returns bookings
language plpgsql as $$
declare
  b bookings;
  v_allowed boolean;
begin
  select * into b from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking % not found', p_booking_id using errcode = 'P0002';
  end if;

  v_allowed := case b.status
    when 'pending'   then p_to in ('confirmed', 'cancelled')
    when 'confirmed' then p_to in ('active', 'cancelled', 'no_show')
    when 'active'    then p_to = 'completed'
    else false
  end;
  if not v_allowed then
    raise exception 'illegal booking transition % -> %', b.status, p_to using errcode = 'BC001';
  end if;

  update bookings set status = p_to where id = p_booking_id returning * into b;

  if p_to in ('cancelled', 'no_show') then
    delete from unit_occupancy where booking_id = b.id;
  elsif p_to = 'completed' and b.fleet_unit_id is not null and b.dropoff_branch_id is not null then
    update fleet_units set branch_id = b.dropoff_branch_id where id = b.fleet_unit_id;
  end if;

  return b;
end $$;

revoke all on function transition_booking(uuid, text) from public, anon, authenticated;
grant execute on function transition_booking(uuid, text) to service_role;
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:db -- 0`
Expected: files 01, 02 and 03 all `PASS`.

- [ ] **Step 5: Commit**

```bash
git add migrations/0005_booking_lifecycle.sql tests/sql
git commit -m "Add booking status machine, marketplace booking columns and revenue views (migration 0005)"
```

---

### Task 5: Availability and atomic booking functions (migration 0006)

**Files:**
- Create: `tests/sql/04_booking_engine.test.sql`, `migrations/0006_booking_functions.sql`

**Interfaces:**
- Consumes: everything from Tasks 2 to 4.
- Produces (all callable by `service_role` only):
  - `unit_branch_at(p_unit_id uuid, p_at timestamptz) returns int`
  - `free_units(p_vehicle_id uuid, p_pickup_branch_id int, p_dropoff_branch_id int, p_start timestamptz, p_end timestamptz) returns table(unit_id uuid, vehicle_id uuid)`. Pass `null` for `p_vehicle_id` to search all vehicles.
  - `available_vehicle_ids(p_pickup_branch_id int, p_dropoff_branch_id int, p_start timestamptz, p_end timestamptz) returns setof uuid`
  - `create_booking_atomic(p_vehicle_id uuid, p_pickup_branch_id int, p_dropoff_branch_id int, p_pickup_at timestamptz, p_dropoff_at timestamptz, p_customer_name text, p_email text, p_total_amount numeric, p_reference text, p_phone text default null, p_payment_method text default null, p_source text default 'web', p_guest_id uuid default null, p_user_id uuid default null) returns bookings`. Errors: `BC002` no unit free, `BC003` unknown branch, `BC004` drop-off not after pick-up.
- Behaviour: the drop-off branch `turnaround_minutes` is added to the end of the occupancy range. A unit is only offered if it is at the pickup branch at pickup time and its next booking (if any) starts at the drop-off branch. Individual units (`requires_window`) are offered only when one availability window contains the whole rental. Existing future `pending` or `confirmed` bookings are assigned units by a backfill at the end of the migration.

- [ ] **Step 1: Write the failing test `tests/sql/04_booking_engine.test.sql`**

```sql
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
select test.assert(not has_function_privilege('anon', 'create_booking_atomic(uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text,numeric,text,text,text,text,uuid,uuid)', 'execute'), 'anon cannot execute create_booking_atomic');
select test.assert(has_function_privilege('service_role', 'create_booking_atomic(uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text,numeric,text,text,text,text,uuid,uuid)', 'execute'), 'service_role can execute create_booking_atomic');
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:db -- 04`
Expected: `FAIL 04_booking_engine.test.sql` with `function create_booking_atomic ... does not exist`. (The first assertion fails earlier because no unit is assigned to the future booking.)

- [ ] **Step 3: Create `migrations/0006_booking_functions.sql`**

```sql
-- Availability search and atomic booking. Concurrency: two transactions may
-- pick the same free unit, but only one can insert its occupancy row; the
-- other gets an exclusion_violation and moves on to the next candidate.

-- Where a unit will be at a given time: the drop-off branch of its latest
-- open booking that ends by then, otherwise its current branch.
create or replace function unit_branch_at(p_unit_id uuid, p_at timestamptz)
returns int language sql stable as $$
  select coalesce(
    (select b.dropoff_branch_id from bookings b
      where b.fleet_unit_id = p_unit_id
        and b.status in ('pending', 'confirmed', 'active')
        and b.dropoff_branch_id is not null
        and b.dropoff_at <= p_at
      order by b.dropoff_at desc
      limit 1),
    (select u.branch_id from fleet_units u where u.id = p_unit_id)
  );
$$;

-- Units that can serve [p_start, p_end) from pickup branch to drop-off branch.
-- Pass null for p_vehicle_id to search every vehicle. Ordered by mileage so
-- wear is spread across the fleet.
create or replace function free_units(
  p_vehicle_id uuid,
  p_pickup_branch_id int,
  p_dropoff_branch_id int,
  p_start timestamptz,
  p_end timestamptz
) returns table (unit_id uuid, vehicle_id uuid)
language sql stable as $$
  select u.id, u.vehicle_id
  from fleet_units u
  join branches pb on pb.id = p_pickup_branch_id  and pb.provider_id = u.provider_id and pb.is_active
  join branches db on db.id = p_dropoff_branch_id and db.provider_id = u.provider_id and db.is_active
  join providers p on p.id = u.provider_id and p.status = 'approved'
  where u.status = 'active'
    and p_end > p_start
    and (p_vehicle_id is null or u.vehicle_id = p_vehicle_id)
    and unit_branch_at(u.id, p_start) = p_pickup_branch_id
    and not exists (
      select 1 from unit_occupancy o
      where o.fleet_unit_id = u.id
        and o.during && tstzrange(p_start, p_end + make_interval(mins => db.turnaround_minutes), '[)')
    )
    and (not u.requires_window or exists (
      select 1 from availability_windows w
      where w.fleet_unit_id = u.id and w.during @> tstzrange(p_start, p_end, '[)')
    ))
    and not exists (
      select 1 from (
        select nb.pickup_branch_id
        from bookings nb
        where nb.fleet_unit_id = u.id
          and nb.status in ('pending', 'confirmed', 'active')
          and nb.pickup_at >= p_end
        order by nb.pickup_at
        limit 1
      ) nxt
      where nxt.pickup_branch_id is distinct from p_dropoff_branch_id
    )
  order by u.mileage_km, u.id;
$$;

create or replace function available_vehicle_ids(
  p_pickup_branch_id int, p_dropoff_branch_id int, p_start timestamptz, p_end timestamptz
) returns setof uuid
language sql stable as $$
  select distinct f.vehicle_id
  from free_units(null, p_pickup_branch_id, p_dropoff_branch_id, p_start, p_end) f;
$$;

create or replace function create_booking_atomic(
  p_vehicle_id uuid,
  p_pickup_branch_id int,
  p_dropoff_branch_id int,
  p_pickup_at timestamptz,
  p_dropoff_at timestamptz,
  p_customer_name text,
  p_email text,
  p_total_amount numeric,
  p_reference text,
  p_phone text default null,
  p_payment_method text default null,
  p_source text default 'web',
  p_guest_id uuid default null,
  p_user_id uuid default null
) returns bookings
language plpgsql as $$
declare
  cand record;
  b bookings;
  v_currency char(3);
  v_buffer interval;
  v_provider uuid;
begin
  if p_dropoff_at <= p_pickup_at then
    raise exception 'drop-off must be after pick-up' using errcode = 'BC004';
  end if;

  select currency into v_currency from branches where id = p_pickup_branch_id;
  if not found then
    raise exception 'unknown pickup branch %', p_pickup_branch_id using errcode = 'BC003';
  end if;
  select make_interval(mins => turnaround_minutes) into v_buffer from branches where id = p_dropoff_branch_id;
  if not found then
    raise exception 'unknown drop-off branch %', p_dropoff_branch_id using errcode = 'BC003';
  end if;

  for cand in
    select * from free_units(p_vehicle_id, p_pickup_branch_id, p_dropoff_branch_id, p_pickup_at, p_dropoff_at)
  loop
    begin
      select provider_id into v_provider from fleet_units where id = cand.unit_id;

      insert into bookings (
        reference, vehicle_id, customer_name, email, phone,
        pickup_at, dropoff_at, total_amount, payment_method, status, source,
        guest_id, user_id, provider_id, fleet_unit_id, pickup_branch_id, dropoff_branch_id, currency
      ) values (
        p_reference, p_vehicle_id, p_customer_name, p_email, p_phone,
        p_pickup_at, p_dropoff_at, p_total_amount, p_payment_method, 'pending', p_source,
        p_guest_id, p_user_id, v_provider, cand.unit_id, p_pickup_branch_id, p_dropoff_branch_id, v_currency
      ) returning * into b;

      insert into unit_occupancy (fleet_unit_id, provider_id, reason, booking_id, during)
      values (cand.unit_id, v_provider, 'booking', b.id, tstzrange(p_pickup_at, p_dropoff_at + v_buffer, '[)'));

      return b;
    exception when exclusion_violation then
      -- A concurrent booking took this unit between the search and the insert;
      -- the subtransaction rolled back our booking row. Try the next unit.
      continue;
    end;
  end loop;

  raise exception 'no vehicle available for the selected dates' using errcode = 'BC002';
end $$;

-- Only the service role (Next.js route handlers) may call the engine.
revoke all on function unit_branch_at(uuid, timestamptz) from public, anon, authenticated;
revoke all on function free_units(uuid, int, int, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function available_vehicle_ids(int, int, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function create_booking_atomic(uuid, int, int, timestamptz, timestamptz, text, text, numeric, text, text, text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function unit_branch_at(uuid, timestamptz) to service_role;
grant execute on function free_units(uuid, int, int, timestamptz, timestamptz) to service_role;
grant execute on function available_vehicle_ids(int, int, timestamptz, timestamptz) to service_role;
grant execute on function create_booking_atomic(uuid, int, int, timestamptz, timestamptz, text, text, numeric, text, text, text, text, uuid, uuid) to service_role;

-- ---------------------------------------------------------------
-- Backfill: give every future pending/confirmed legacy booking a unit and an
-- occupancy row. Bookings that cannot be placed stay unassigned with a warning.
-- ---------------------------------------------------------------
do $$
declare
  r record;
  v_pickup int;
  v_drop int;
  v_unit uuid;
  v_provider uuid;
  v_buffer interval;
begin
  for r in
    select * from bookings
    where status in ('pending', 'confirmed') and dropoff_at > now()
      and fleet_unit_id is null and vehicle_id is not null
    order by pickup_at
  loop
    v_pickup := coalesce(r.pickup_branch_id,
      (select u.branch_id from fleet_units u where u.vehicle_id = r.vehicle_id and u.status = 'active' order by u.plate limit 1));
    v_drop := coalesce(r.dropoff_branch_id, v_pickup);

    select f.unit_id into v_unit
    from free_units(r.vehicle_id, v_pickup, v_drop, r.pickup_at, r.dropoff_at) f
    limit 1;

    if v_unit is null then
      raise warning 'booking % could not be assigned a unit; left unassigned', r.reference;
      continue;
    end if;

    select provider_id into v_provider from fleet_units where id = v_unit;
    select make_interval(mins => turnaround_minutes) into v_buffer from branches where id = v_drop;

    update bookings
    set fleet_unit_id = v_unit, provider_id = v_provider,
        pickup_branch_id = v_pickup, dropoff_branch_id = v_drop
    where id = r.id;

    insert into unit_occupancy (fleet_unit_id, provider_id, reason, booking_id, during)
    values (v_unit, v_provider, 'booking', r.id, tstzrange(r.pickup_at, r.dropoff_at + v_buffer, '[)'));
  end loop;
end $$;
```

- [ ] **Step 4: Run all SQL tests**

Run: `npm run test:db`
Expected: files 01 to 04 all `PASS`, `4/4 SQL test files passed`.

- [ ] **Step 5: Commit**

```bash
git add migrations/0006_booking_functions.sql tests/sql
git commit -m "Add availability search and atomic booking functions with backfill (migration 0006)"
```

---

### Task 6: TypeScript domain layer (status machine, error mapping, types)

**Files:**
- Create: `src/lib/booking-state.ts`, `src/lib/booking-state.test.ts`, `src/lib/booking-errors.ts`, `src/lib/booking-errors.test.ts`, `src/lib/schemas.test.ts`
- Modify: `src/types/database.ts`, `src/lib/schemas.ts:44-49`, `src/components/admin/booking-status-badge.tsx`, `src/app/admin/(protected)/bookings/page.tsx`, `src/components/admin/recent-transactions-panel.tsx`

**Interfaces:**
- Consumes: SQL status matrix and error codes from Tasks 4 and 5.
- Produces:
  - `BookingStatus` (six values), `BOOKING_STATUSES`, `BOOKING_STATUS_LABELS`, `BOOKING_STATUS_OPTIONS: { value: BookingStatus; label: string }[]`, `canTransition(from, to): boolean`, `nextStatuses(from): readonly BookingStatus[]`, `assertTransition(from, to): void` (throws `ConflictError`), `REVENUE_STATUSES`
  - `toBookingApiError(error: { code?: string; message: string }, context: string): Error`
  - Database types for the new tables, `BookingRow`, and the RPC signatures `create_booking_atomic`, `transition_booking`, `available_vehicle_ids`.

- [ ] **Step 1: Write the failing tests**

`src/lib/booking-state.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  BOOKING_STATUSES,
  BOOKING_STATUS_OPTIONS,
  assertTransition,
  canTransition,
  nextStatuses,
} from "@/lib/booking-state";
import { ConflictError } from "@/lib/errors";

// Mirror of the matrix in tests/sql/03_booking_lifecycle.test.sql.
const LEGAL = new Set([
  "pending>confirmed",
  "pending>cancelled",
  "confirmed>active",
  "confirmed>cancelled",
  "confirmed>no_show",
  "active>completed",
]);

describe("booking state machine", () => {
  it("allows exactly the legal transitions", () => {
    for (const from of BOOKING_STATUSES) {
      for (const to of BOOKING_STATUSES) {
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(LEGAL.has(`${from}>${to}`));
      }
    }
  });

  it("lists next statuses and has none for terminal states", () => {
    expect(nextStatuses("pending")).toEqual(["confirmed", "cancelled"]);
    expect(nextStatuses("completed")).toEqual([]);
    expect(nextStatuses("cancelled")).toEqual([]);
    expect(nextStatuses("no_show")).toEqual([]);
  });

  it("assertTransition throws a 409 for an illegal move", () => {
    expect(() => assertTransition("completed", "pending")).toThrow(ConflictError);
    expect(() => assertTransition("pending", "confirmed")).not.toThrow();
  });

  it("exposes a labelled option per status", () => {
    expect(BOOKING_STATUS_OPTIONS).toHaveLength(6);
    expect(BOOKING_STATUS_OPTIONS.find((o) => o.value === "no_show")?.label).toBe("No-show");
  });
});
```

`src/lib/booking-errors.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { toBookingApiError } from "@/lib/booking-errors";
import { ApiError, ConflictError, NotFoundError } from "@/lib/errors";

describe("toBookingApiError", () => {
  it("maps BC002 to a 409 about availability", () => {
    const err = toBookingApiError({ code: "BC002", message: "x" }, "createBooking");
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.message).toMatch(/no longer available/i);
  });

  it("maps BC001 to a 409", () => {
    expect(toBookingApiError({ code: "BC001", message: "x" }, "updateBookingStatus")).toBeInstanceOf(ConflictError);
  });

  it("maps BC003 and BC004 to 400s", () => {
    for (const code of ["BC003", "BC004"]) {
      const err = toBookingApiError({ code, message: "x" }, "createBooking");
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(400);
    }
  });

  it("maps P0002 to a 404", () => {
    expect(toBookingApiError({ code: "P0002", message: "x" }, "updateBookingStatus")).toBeInstanceOf(NotFoundError);
  });

  it("wraps unknown errors with context so they become a 500", () => {
    const err = toBookingApiError({ code: "XX000", message: "boom" }, "createBooking");
    expect(err).not.toBeInstanceOf(ApiError);
    expect(err.message).toBe("createBooking: boom");
  });
});
```

`src/lib/schemas.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { BookingStatusSchema } from "@/lib/schemas";

describe("BookingStatusSchema", () => {
  it("accepts the six lifecycle statuses", () => {
    for (const s of ["pending", "confirmed", "active", "completed", "cancelled", "no_show"]) {
      expect(BookingStatusSchema.safeParse(s).success).toBe(true);
    }
  });

  it("rejects the retired legacy status", () => {
    expect(BookingStatusSchema.safeParse("success").success).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run`
Expected: FAIL. `Failed to resolve import "@/lib/booking-state"` and `"@/lib/booking-errors"`.

- [ ] **Step 3: Update `src/types/database.ts` types**

Replace the `BookingStatus` line (currently `export type BookingStatus = "success" | "pending" | "cancelled";`) with:
```ts
export type BookingStatus = "pending" | "confirmed" | "active" | "completed" | "cancelled" | "no_show";
export type ProviderType = "company" | "individual";
export type ProviderStatus = "draft" | "submitted" | "under_review" | "approved" | "rejected" | "suspended";
export type MemberRole = "owner" | "manager" | "agent";
export type FleetUnitStatus = "active" | "maintenance" | "retired";
export type OccupancyReason = "booking" | "maintenance" | "transfer" | "owner_block";

/** Insert shape helper: everything optional except the listed required keys. */
type InsertOf<Row, Required extends keyof Row> = Partial<Row> & Pick<Row, Required>;

export interface ProviderRow {
  id: string;
  type: ProviderType;
  legal_name: string;
  display_name: string;
  country_code: string;
  default_currency: string;
  status: ProviderStatus;
  commission_rate_override: number | null;
  created_at: string;
}

export interface BranchRow {
  id: number;
  provider_id: string;
  code: string;
  name: string;
  city: string;
  country: string;
  country_code: string;
  address: string | null;
  timezone: string;
  currency: string;
  turnaround_minutes: number;
  opening_hours: Json | null;
  is_active: boolean;
  created_at: string;
}

export interface ProviderMemberRow {
  provider_id: string;
  user_id: string;
  role: MemberRole;
  branch_id: number | null;
  created_at: string;
}

export interface FleetUnitRow {
  id: string;
  provider_id: string;
  branch_id: number;
  vehicle_id: string;
  plate: string;
  vin: string | null;
  mileage_km: number;
  status: FleetUnitStatus;
  requires_window: boolean;
  created_at: string;
}

/** `during` is a Postgres tstzrange in its text form, e.g. `["2030-01-01 00:00:00+00","2030-01-02 00:00:00+00")`. */
export interface AvailabilityWindowRow {
  id: string;
  fleet_unit_id: string;
  provider_id: string;
  during: string;
}

export interface UnitOccupancyRow {
  id: string;
  fleet_unit_id: string;
  provider_id: string;
  reason: OccupancyReason;
  booking_id: string | null;
  during: string;
  created_at: string;
}

export interface BookingRow {
  id: string;
  reference: string;
  vehicle_id: string | null;
  customer_name: string;
  email: string;
  phone: string | null;
  pickup_location_id: number | null;
  dropoff_location_id: number | null;
  guest_id: string | null;
  user_id: string | null;
  provider_id: string | null;
  fleet_unit_id: string | null;
  pickup_branch_id: number | null;
  dropoff_branch_id: number | null;
  currency: string | null;
  pickup_at: string;
  dropoff_at: string;
  /** Generated column (`greatest(1, extract(day from dropoff_at - pickup_at))`), read-only. */
  days: number;
  total_amount: number;
  payment_method: PaymentMethod | null;
  status: BookingStatus;
  lead_score: number | null;
  source: BookingSource | null;
  created_at: string | null;
}
```

In `Database["public"]["Tables"]`, replace the whole inline `Row: { ... };` of `bookings` with `Row: BookingRow;`, and add these fields to both the `Insert` and `Update` objects of `bookings`:
```ts
          provider_id?: string | null;
          fleet_unit_id?: string | null;
          pickup_branch_id?: number | null;
          dropoff_branch_id?: number | null;
          currency?: string | null;
```
Add the new tables next to `locations`:
```ts
      providers: {
        Row: ProviderRow;
        Insert: InsertOf<ProviderRow, "type" | "legal_name" | "display_name" | "country_code" | "default_currency">;
        Update: Partial<ProviderRow>;
        Relationships: [];
      };
      branches: {
        Row: BranchRow;
        Insert: InsertOf<BranchRow, "provider_id" | "code" | "name" | "city" | "country" | "country_code" | "currency">;
        Update: Partial<BranchRow>;
        Relationships: [];
      };
      provider_members: {
        Row: ProviderMemberRow;
        Insert: InsertOf<ProviderMemberRow, "provider_id" | "user_id" | "role">;
        Update: Partial<ProviderMemberRow>;
        Relationships: [];
      };
      fleet_units: {
        Row: FleetUnitRow;
        Insert: InsertOf<FleetUnitRow, "provider_id" | "branch_id" | "vehicle_id" | "plate">;
        Update: Partial<FleetUnitRow>;
        Relationships: [];
      };
      availability_windows: {
        Row: AvailabilityWindowRow;
        Insert: InsertOf<AvailabilityWindowRow, "fleet_unit_id" | "provider_id" | "during">;
        Update: Partial<AvailabilityWindowRow>;
        Relationships: [];
      };
      unit_occupancy: {
        Row: UnitOccupancyRow;
        Insert: InsertOf<UnitOccupancyRow, "fleet_unit_id" | "provider_id" | "reason" | "during">;
        Update: Partial<UnitOccupancyRow>;
        Relationships: [];
      };
```
Add to `Functions` (keep the two old stock functions until Task 9):
```ts
      create_booking_atomic: {
        Args: {
          p_vehicle_id: string;
          p_pickup_branch_id: number;
          p_dropoff_branch_id: number;
          p_pickup_at: string;
          p_dropoff_at: string;
          p_customer_name: string;
          p_email: string;
          p_total_amount: number;
          p_reference: string;
          p_phone?: string | null;
          p_payment_method?: PaymentMethod | null;
          p_source?: BookingSource;
          p_guest_id?: string | null;
          p_user_id?: string | null;
        };
        Returns: BookingRow;
      };
      transition_booking: {
        Args: { p_booking_id: string; p_to: BookingStatus };
        Returns: BookingRow;
      };
      available_vehicle_ids: {
        Args: {
          p_pickup_branch_id: number;
          p_dropoff_branch_id: number;
          p_start: string;
          p_end: string;
        };
        Returns: string[];
      };
```

- [ ] **Step 4: Create `src/lib/booking-state.ts`**

```ts
import { ConflictError } from "@/lib/errors";
import type { BookingStatus } from "@/types/database";

/** The status machine lives in SQL (`transition_booking`, migration 0005);
 * this is its mirror for the UI and for early validation. The two tables are
 * kept identical by src/lib/booking-state.test.ts and
 * tests/sql/03_booking_lifecycle.test.sql. */
const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["active", "cancelled", "no_show"],
  active: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "active",
  "completed",
  "cancelled",
  "no_show",
] as const satisfies readonly BookingStatus[];

/** Statuses that count as revenue in dashboards and views. */
export const REVENUE_STATUSES = ["confirmed", "active", "completed"] as const satisfies readonly BookingStatus[];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export const BOOKING_STATUS_OPTIONS: { value: BookingStatus; label: string }[] = BOOKING_STATUSES.map(
  (value) => ({ value, label: BOOKING_STATUS_LABELS[value] })
);

export function nextStatuses(from: BookingStatus): readonly BookingStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) {
    throw new ConflictError(
      `A ${BOOKING_STATUS_LABELS[from].toLowerCase()} booking cannot be changed to ${BOOKING_STATUS_LABELS[to].toLowerCase()}.`
    );
  }
}
```

- [ ] **Step 5: Create `src/lib/booking-errors.ts`**

```ts
import { ApiError, ConflictError, NotFoundError } from "@/lib/errors";

export interface RpcError {
  code?: string;
  message: string;
}

/** Turns an error from one of the booking SQL functions into the API error
 * `withErrorHandling` should return. Unknown errors stay plain `Error`s so
 * they surface as a logged 500 without leaking internals. */
export function toBookingApiError(error: RpcError, context: string): Error {
  switch (error.code) {
    case "BC001":
      return new ConflictError("This booking cannot be moved to that status from its current state.");
    case "BC002":
      return new ConflictError("This vehicle is no longer available for the selected dates.");
    case "BC003":
      return new ApiError(400, "Unknown pick-up or drop-off location.");
    case "BC004":
      return new ApiError(400, "Drop-off must be after pick-up.");
    case "P0002":
      return new NotFoundError("Booking not found.");
    default:
      return new Error(`${context}: ${error.message}`);
  }
}
```

- [ ] **Step 6: Update `BookingStatusSchema` in `src/lib/schemas.ts`**

Replace the `bookingStatusValues` array (lines 44-49) with:
```ts
const bookingStatusValues = [
  "pending",
  "confirmed",
  "active",
  "completed",
  "cancelled",
  "no_show",
] as const satisfies readonly BookingStatus[];
```

- [ ] **Step 7: Run unit tests**

Run: `npx vitest run`
Expected: `3 passed` test files, all tests green.

- [ ] **Step 8: Fix the compile errors the new union causes**

Run: `npx tsc --noEmit`
Expected: errors in `booking-status-badge.tsx` (the `Record<BookingStatus, ...>` maps miss keys).

Replace the two maps in `src/components/admin/booking-status-badge.tsx` with:
```tsx
import { BOOKING_STATUS_LABELS } from "@/lib/booking-state";

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  confirmed: "bg-info/15 text-info-text",
  active: "bg-info/15 text-info-text",
  completed: "bg-success/15 text-success-text",
  cancelled: "bg-destructive/15 text-destructive",
  no_show: "bg-destructive/15 text-destructive",
};
```
Delete the local `STATUS_LABELS` and render `{BOOKING_STATUS_LABELS[status]}` instead.

In `src/app/admin/(protected)/bookings/page.tsx` (around lines 187-194 and 242-250) and `src/components/admin/recent-transactions-panel.tsx` (around lines 149-157), each status filter has a hard-coded `{ value: "success", label: "Success" }` entry in an `items` array and a `<SelectItem value="success">Success</SelectItem>`. Read each block and replace the three fixed status entries (success, pending, cancelled) with the shared list, keeping the existing "all statuses" entry first:
```tsx
...BOOKING_STATUS_OPTIONS,
```
in the `items` arrays, and
```tsx
{BOOKING_STATUS_OPTIONS.map((o) => (
  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
))}
```
in the `SelectContent`. Import `BOOKING_STATUS_OPTIONS` from `@/lib/booking-state`.

In `src/app/admin/(protected)/bookings/page.tsx` around line 104 (`fetch(\`/api/bookings/${id}\`...`) the page changes a booking status. Read the surrounding code; wherever it offers status choices for a row, offer only `nextStatuses(row.status)` (import from `@/lib/booking-state`) and hide the control when the list is empty.

- [ ] **Step 9: Verify**

Run: `npx tsc --noEmit; npm run lint; npx vitest run`
Expected: no TypeScript errors, lint passes, tests green.

- [ ] **Step 10: Commit**

```bash
git add src tests
git commit -m "Add booking status machine, error mapping and marketplace DB types"
```

---

### Task 7: Queries and API routes on the new engine

**Files:**
- Modify: `src/lib/schemas.ts`, `src/lib/queries.ts`, `src/app/api/bookings/route.ts`, `src/app/api/bookings/[id]/route.ts`, `src/app/api/locations/route.ts`, `src/app/api/vehicles/route.ts`
- Create: `src/lib/schemas.booking.test.ts`

**Interfaces:**
- Consumes: `toBookingApiError` and the RPC types (Task 6).
- Produces:
  - `CreateBookingSchema` fields `pickup_branch_id`, `dropoff_branch_id` (both optional, nullable) replacing the `*_location_id` fields.
  - `VehiclesQuerySchema` extra optional fields `pickupLocationId`, `dropoffLocationId`, `pickupDate`, `dropoffDate` (`YYYY-MM-DD`).
  - `VehicleFilters.availability?: { pickupBranchId: number; dropoffBranchId: number; from: Date; to: Date }`.
  - `createBooking(data: CreateBookingInput): Promise<Tables<"bookings">>` (now via `create_booking_atomic`), `updateBookingStatus(id, status)` (via `transition_booking`, no-op if unchanged), `getLocations(): Promise<BranchOption[]>` where `BranchOption = Pick<Tables<"branches">, "id" | "city" | "country" | "country_code">`.
  - `createVehicle` accepts `stock` as "initial number of units" and creates that many `fleet_units`. `updateVehicle` never changes stock.

- [ ] **Step 1: Read the Next.js route handler docs**

Run: `ls node_modules/next/dist/docs/01-app/03-api-reference` and read the route handler page before editing routes (per `AGENTS.md`). The edits below only change payloads, not the handler shape.

- [ ] **Step 2: Write the failing schema test `src/lib/schemas.booking.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { CreateBookingSchema, UpdateVehicleSchema, VehiclesQuerySchema } from "@/lib/schemas";

const base = {
  vehicle_id: "11111111-1111-4111-8111-111111111111",
  customer_name: "Jane",
  email: "jane@example.com",
  pickup_at: "2030-03-01T10:00:00Z",
  dropoff_at: "2030-03-03T10:00:00Z",
};

describe("CreateBookingSchema", () => {
  it("accepts branch ids", () => {
    const r = CreateBookingSchema.safeParse({ ...base, pickup_branch_id: "1", dropoff_branch_id: 2 });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.pickup_branch_id).toBe(1);
      expect(r.data.dropoff_branch_id).toBe(2);
    }
  });

  it("rejects drop-off before pick-up", () => {
    const r = CreateBookingSchema.safeParse({ ...base, dropoff_at: "2030-02-01T10:00:00Z" });
    expect(r.success).toBe(false);
  });
});

describe("VehiclesQuerySchema availability params", () => {
  it("parses location ids and dates", () => {
    const r = VehiclesQuerySchema.safeParse({
      pickupLocationId: "1",
      dropoffLocationId: "2",
      pickupDate: "2030-03-01",
      dropoffDate: "2030-03-03",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a drop-off date on or before the pick-up date", () => {
    const r = VehiclesQuerySchema.safeParse({ pickupDate: "2030-03-03", dropoffDate: "2030-03-03" });
    expect(r.success).toBe(false);
  });
});

describe("UpdateVehicleSchema", () => {
  it("does not let an update set stock (fleet size comes from units)", () => {
    const r = UpdateVehicleSchema.safeParse({ id: "11111111-1111-4111-8111-111111111111", stock: 5 });
    expect(r.success).toBe(true);
    if (r.success) expect("stock" in r.data).toBe(false);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/lib/schemas.booking.test.ts`
Expected: FAIL (`pickup_branch_id` is stripped as an unknown key so it is `undefined`, the date-order check does not exist, and `stock` is still accepted).

- [ ] **Step 4: Update `src/lib/schemas.ts`**

In `CreateBookingSchema` replace the two location fields with:
```ts
    pickup_branch_id: z.coerce.number().int().positive().nullable().optional(),
    dropoff_branch_id: z.coerce.number().int().positive().nullable().optional(),
```
In `VehiclesQuerySchema`, add after `locationId`:
```ts
    /** Availability search: needs pickupLocationId + both dates to take effect. */
    pickupLocationId: z.coerce.number().int().positive().optional(),
    dropoffLocationId: z.coerce.number().int().positive().optional(),
    pickupDate: DateOnlySchema.optional(),
    dropoffDate: DateOnlySchema.optional(),
```
and extend the existing `.refine(...)` chain with a second refine:
```ts
  .refine(
    (data) => !data.pickupDate || !data.dropoffDate || data.dropoffDate > data.pickupDate,
    { message: "dropoffDate must be after pickupDate", path: ["dropoffDate"] }
  )
```
Replace `UpdateVehicleSchema` with:
```ts
export const UpdateVehicleSchema = VehicleFieldsSchema.omit({ stock: true }).partial().extend({
  id: z.uuid("id must be a valid UUID"),
});
```

- [ ] **Step 5: Run to verify the schema tests pass**

Run: `npx vitest run`
Expected: all test files pass.

- [ ] **Step 6: Update `src/lib/queries.ts` (vehicles listing)**

Add `availability` to `VehicleFilters`:
```ts
  /** Only vehicles with a free unit for this trip. */
  availability?: { pickupBranchId: number; dropoffBranchId: number; from: Date; to: Date };
```
Add this helper above `getVehicles`:
```ts
/** Vehicle ids allowed by the branch/availability filters, or null for "no restriction".
 * Uses the availability RPC when dates are given, otherwise units at the branch.
 * (An `in` list is fine at current catalogue size; move this into SQL if the
 * catalogue grows to thousands of models.) */
async function resolveVehicleIdFilter(filters: VehicleFilters): Promise<string[] | null> {
  const { locationId, availability } = filters;

  if (availability) {
    const { data, error } = await supabaseAdmin.rpc("available_vehicle_ids", {
      p_pickup_branch_id: availability.pickupBranchId,
      p_dropoff_branch_id: availability.dropoffBranchId,
      p_start: availability.from.toISOString(),
      p_end: availability.to.toISOString(),
    });
    if (error) throw new Error(`resolveVehicleIdFilter: ${error.message}`);
    return data ?? [];
  }

  if (locationId !== undefined) {
    const { data, error } = await supabaseAdmin
      .from("fleet_units")
      .select("vehicle_id")
      .eq("branch_id", locationId)
      .eq("status", "active");
    if (error) throw new Error(`resolveVehicleIdFilter: ${error.message}`);
    return [...new Set((data ?? []).map((row) => row.vehicle_id))];
  }

  return null;
}
```
In both `getVehicles` and `getVehicleCards`: remove `locationId` from the destructuring, delete the line `if (locationId !== undefined) query = query.eq("location_id", locationId);`, and right after the query is created insert:
```ts
  const idFilter = await resolveVehicleIdFilter(filters);
  if (idFilter) {
    if (idFilter.length === 0) return { data: [], count: 0 };
    query = query.in("id", idFilter);
  }
```

- [ ] **Step 7: Update `src/lib/queries.ts` (bookings, locations, vehicle writes)**

Add imports at the top: `import { toBookingApiError } from "@/lib/booking-errors";` and extend the type import with `BookingSource, PaymentMethod`.

Replace `CreateBookingInput`, `generateBookingReference` stays, and `createBooking` (the whole block from `export type CreateBookingInput` to the end of `createBooking`) with:
```ts
export interface CreateBookingInput {
  vehicle_id: string;
  customer_name: string;
  email: string;
  phone: string | null;
  pickup_branch_id: number | null;
  dropoff_branch_id: number | null;
  guest_id: string | null;
  user_id: string | null;
  pickup_at: string;
  dropoff_at: string;
  payment_method: PaymentMethod | null;
  source?: BookingSource;
}

function generateBookingReference(): string {
  return `BC-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/** Explicit branch, else the vehicle's home branch, else the branch of its first active unit. */
async function resolvePickupBranchId(
  vehicleId: string,
  requested: number | null,
  homeBranchId: number | null
): Promise<number> {
  if (requested) return requested;
  if (homeBranchId) return homeBranchId;
  const { data, error } = await supabaseAdmin
    .from("fleet_units")
    .select("branch_id")
    .eq("vehicle_id", vehicleId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`createBooking: ${error.message}`);
  if (!data) throw new ConflictError("This vehicle is no longer available for booking.");
  return data.branch_id;
}

export async function createBooking(data: CreateBookingInput): Promise<Tables<"bookings">> {
  const { data: vehicle, error: vehicleError } = await supabaseAdmin
    .from("vehicles")
    .select("price_per_day, location_id")
    .eq("id", data.vehicle_id)
    .maybeSingle();
  if (vehicleError) throw new Error(`createBooking: ${vehicleError.message}`);
  if (!vehicle) throw new NotFoundError(`Vehicle ${data.vehicle_id} not found`);

  const pickupBranchId = await resolvePickupBranchId(
    data.vehicle_id,
    data.pickup_branch_id,
    vehicle.location_id
  );
  const dropoffBranchId = data.dropoff_branch_id ?? pickupBranchId;

  // Pricing engine arrives in sub-project 2; until then: price_per_day x whole days.
  const days = daysBetween(data.pickup_at, data.dropoff_at);
  const totalAmount = Math.round(vehicle.price_per_day * days * 100) / 100;

  const { data: booking, error } = await supabaseAdmin.rpc("create_booking_atomic", {
    p_vehicle_id: data.vehicle_id,
    p_pickup_branch_id: pickupBranchId,
    p_dropoff_branch_id: dropoffBranchId,
    p_pickup_at: data.pickup_at,
    p_dropoff_at: data.dropoff_at,
    p_customer_name: data.customer_name,
    p_email: data.email,
    p_total_amount: totalAmount,
    p_reference: generateBookingReference(),
    p_phone: data.phone,
    p_payment_method: data.payment_method,
    p_source: data.source ?? "web",
    p_guest_id: data.guest_id,
    p_user_id: data.user_id,
  });

  if (error) throw toBookingApiError(error, "createBooking");
  return booking;
}
```
Replace the whole `updateBookingStatus` function (through its closing brace, including the stock-restore block) with:
```ts
export async function updateBookingStatus(
  id: string,
  status: BookingStatus
): Promise<Tables<"bookings">> {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("bookings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (existingError) throw new Error(`updateBookingStatus: ${existingError.message}`);
  if (!existing) throw new NotFoundError(`Booking ${id} not found`);
  if (existing.status === status) return existing;

  // Legality, unit release and unit relocation all happen in one SQL function.
  const { data: booking, error } = await supabaseAdmin.rpc("transition_booking", {
    p_booking_id: id,
    p_to: status,
  });
  if (error) throw toBookingApiError(error, "updateBookingStatus");
  return booking;
}
```
Replace `getLocations` with:
```ts
export type BranchOption = Pick<Tables<"branches">, "id" | "city" | "country" | "country_code">;

/** Pick-up/drop-off options: active branches of approved providers. Same
 * ids as the legacy `locations` rows, so existing URLs keep working. */
export async function getLocations(): Promise<BranchOption[]> {
  const { data: providers, error: providerError } = await supabaseAdmin
    .from("providers")
    .select("id")
    .eq("status", "approved");
  if (providerError) throw new Error(`getLocations: ${providerError.message}`);

  const { data, error } = await supabaseAdmin
    .from("branches")
    .select("id, city, country, country_code")
    .eq("is_active", true)
    .in("provider_id", (providers ?? []).map((p) => p.id))
    .order("city", { ascending: true });

  if (error) throw new Error(`getLocations: ${error.message}`);
  return data ?? [];
}
```
Replace `createVehicle` and `updateVehicle` with:
```ts
/** `stock` on create means "initial number of units": that many fleet units
 * are created at the vehicle's home branch (or the first active branch). */
export async function createVehicle(
  data: TablesInsert<"vehicles">
): Promise<Tables<"vehicles">> {
  const { stock: initialUnits = 0, ...fields } = data;

  const { data: vehicle, error } = await supabaseAdmin
    .from("vehicles")
    .insert({ ...fields, stock: 0 })
    .select("*")
    .single();
  if (error) throw new Error(`createVehicle: ${error.message}`);

  if (initialUnits > 0) {
    const branchQuery = supabaseAdmin.from("branches").select("id, provider_id").eq("is_active", true);
    const { data: branch, error: branchError } = fields.location_id
      ? await branchQuery.eq("id", fields.location_id).maybeSingle()
      : await branchQuery.order("id", { ascending: true }).limit(1).maybeSingle();
    if (branchError) throw new Error(`createVehicle: ${branchError.message}`);
    if (!branch) throw new ConflictError("No active branch exists to hold the new vehicle's units.");

    const prefix = vehicle.slug.slice(0, 6).toUpperCase();
    const suffix = randomBytes(2).toString("hex").toUpperCase();
    const units = Array.from({ length: initialUnits }, (_, i) => ({
      provider_id: branch.provider_id,
      branch_id: branch.id,
      vehicle_id: vehicle.id,
      plate: `${prefix}-${suffix}-${i + 1}`,
    }));
    const { error: unitsError } = await supabaseAdmin.from("fleet_units").insert(units);
    if (unitsError) throw new Error(`createVehicle: ${unitsError.message}`);
  }

  const { data: refreshed, error: refreshError } = await supabaseAdmin
    .from("vehicles")
    .select("*")
    .eq("id", vehicle.id)
    .single();
  if (refreshError) throw new Error(`createVehicle: ${refreshError.message}`);
  return refreshed;
}

export async function updateVehicle(
  id: string,
  data: Omit<TablesUpdate<"vehicles">, "stock">
): Promise<Tables<"vehicles">> {
  const { data: vehicle, error } = await supabaseAdmin
    .from("vehicles")
    .update(data)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(`updateVehicle: ${error.message}`);
  if (!vehicle) throw new NotFoundError(`Vehicle ${id} not found`);
  return vehicle;
}
```

- [ ] **Step 8: Update the routes**

`src/app/api/bookings/route.ts`: in the `createBooking({...})` call replace the two location lines with
```ts
    pickup_branch_id: input.pickup_branch_id ?? null,
    dropoff_branch_id: input.dropoff_branch_id ?? null,
```
`src/app/api/vehicles/route.ts`: in `GET`, replace the body after parsing with a version that builds the availability filter:
```ts
  const { fields, pickupLocationId, dropoffLocationId, pickupDate, dropoffDate, ...query } =
    VehiclesQuerySchema.parse(searchParamsToObject(request.nextUrl.searchParams));
  const availability =
    pickupLocationId && pickupDate && dropoffDate
      ? {
          pickupBranchId: pickupLocationId,
          dropoffBranchId: dropoffLocationId ?? pickupLocationId,
          from: new Date(pickupDate),
          to: new Date(dropoffDate),
        }
      : undefined;
  const filters = { ...query, availability };
  const result = fields === "card" ? await getVehicleCards(filters) : await getVehicles(filters);
  return NextResponse.json(result);
```
`src/app/api/locations/route.ts` and `src/app/api/bookings/[id]/route.ts` need no change.

- [ ] **Step 9: Verify**

Run: `npx tsc --noEmit; npm run lint; npx vitest run`
Expected: clean.

- [ ] **Step 10: Commit**

```bash
git add src
git commit -m "Move booking creation, status changes and availability onto the SQL engine"
```

---

### Task 8: Site and admin UI on the new engine

**Files:**
- Modify: `src/components/site/vehicle-booking-panel.tsx`, `src/app/(site)/cars/[slug]/page.tsx`, `src/components/site/vehicle-card.tsx`, `src/components/site/cars-page-content.tsx`, `src/components/admin/vehicle-form-dialog.tsx`, `src/app/admin/(protected)/vehicles/page.tsx`

**Interfaces:**
- Consumes: `CreateBookingSchema` (`pickup_branch_id`, `dropoff_branch_id`), `VehiclesQuerySchema` availability params, `getVehicleCards({ availability })` (Task 7).
- Produces: search context (`pickupLocationId`, `dropoffLocationId`, `pickupDate`, `dropoffDate`) that survives search bar, then results, then vehicle card, then detail page, then the booking request. `VehicleCard` gets an optional `searchQuery?: string` prop. `VehicleBookingPanel` gets optional `pickupBranchId?: number` and `dropoffBranchId?: number`.

- [ ] **Step 1: Booking panel sends branch ids**

In `src/components/site/vehicle-booking-panel.tsx` extend the props:
```tsx
export function VehicleBookingPanel({
  vehicle,
  defaultPickupDate,
  defaultDropoffDate,
  pickupBranchId,
  dropoffBranchId,
}: {
  vehicle: Tables<"vehicles">;
  defaultPickupDate?: string;
  defaultDropoffDate?: string;
  pickupBranchId?: number;
  dropoffBranchId?: number;
}) {
```
and add the two fields to the object passed to `CreateBookingSchema.safeParse` in `handleSubmit`:
```tsx
      pickup_branch_id: pickupBranchId,
      dropoff_branch_id: dropoffBranchId,
```
(`JSON.stringify({ ...result.data, ... })` then carries them to the API. The server's 409 message, "This vehicle is no longer available for the selected dates.", is already shown by the existing `submitError` handling.)

- [ ] **Step 2: Detail page forwards the search context**

In `src/app/(site)/cars/[slug]/page.tsx` change the `searchParams` type and destructuring:
```tsx
  searchParams: Promise<{
    pickupDate?: string;
    dropoffDate?: string;
    pickupLocationId?: string;
    dropoffLocationId?: string;
  }>;
```
```tsx
  const { pickupDate, dropoffDate, pickupLocationId, dropoffLocationId } = await searchParams;
```
Add above the component:
```tsx
function toBranchId(value: string | undefined): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}
```
and pass the two props to the panel:
```tsx
          <VehicleBookingPanel
            vehicle={vehicle}
            defaultPickupDate={pickupDate}
            defaultDropoffDate={dropoffDate}
            pickupBranchId={toBranchId(pickupLocationId)}
            dropoffBranchId={toBranchId(dropoffLocationId)}
          />
```

- [ ] **Step 3: Vehicle card keeps the search context**

In `src/components/site/vehicle-card.tsx` change the signature to
```tsx
export function VehicleCard({ vehicle, searchQuery }: { vehicle: VehicleCardData; searchQuery?: string }) {
```
and, inside the component, add `const href = \`/cars/${vehicle.slug}${searchQuery ? \`?${searchQuery}\` : ""}\`;` then use `href={href}` on both `<Link>` elements (currently `href={\`/cars/${vehicle.slug}\`}` at the two places).

- [ ] **Step 4: Results page filters by availability and carries the context**

In `src/components/site/cars-page-content.tsx`, before the `getVehicleCards` call add:
```tsx
  const availability =
    filters.pickupLocationId && filters.pickupDate && filters.dropoffDate
      ? {
          pickupBranchId: filters.pickupLocationId,
          dropoffBranchId: filters.dropoffLocationId ?? filters.pickupLocationId,
          from: new Date(filters.pickupDate),
          to: new Date(filters.dropoffDate),
        }
      : undefined;

  const carried = new URLSearchParams();
  for (const key of ["pickupLocationId", "dropoffLocationId", "pickupDate", "dropoffDate"]) {
    const value = params.get(key);
    if (value) carried.set(key, value);
  }
  const searchQuery = carried.toString();
```
Add `availability,` to the object passed to `getVehicleCards({ ... })`, and render the cards with the query:
```tsx
                <VehicleCard key={vehicle.id} vehicle={vehicle} searchQuery={searchQuery} />
```

- [ ] **Step 5: Admin vehicle form treats stock as initial fleet size**

In `src/components/admin/vehicle-form-dialog.tsx` the `Stock` field (around lines 200-208) becomes create-only and is relabelled:
```tsx
            {!vehicle && (
              <Field label="Units in fleet" htmlFor="v-stock">
                <Input
                  id="v-stock"
                  type="number"
                  min={0}
                  value={values.stock}
                  onChange={(e) => set("stock", Number(e.target.value))}
                  required
                />
              </Field>
            )}
```
In `src/app/admin/(protected)/vehicles/page.tsx` change the column header at line 174 from `"Stock"` to `"Units"`.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit; npm run lint; npx vitest run`
Expected: clean.

- [ ] **Step 7: Manual check against a staging Supabase project**

The app needs a real Supabase (PostgREST). Use a throwaway Supabase project (or a Supabase branch), never production:
1. In its SQL editor run `schema.sql`, then `migrations/0001` to `0006` in order, then point `.env.local` at it and run `npx tsx seed.ts` (after Task 9's seed changes; until then load a few rows by hand).
2. `npm run dev`. On `/`, search with dates: `/cars` lists only vehicles with a free unit at that branch.
3. Open a vehicle from the results. The URL keeps `pickupLocationId` and dates. Book it: you land on `/booking-confirmation`.
4. Book the same vehicle for the same dates until all units are taken: the next attempt shows "This vehicle is no longer available for the selected dates." and the vehicle disappears from `/cars` for those dates.
5. In `/admin/bookings` move a booking pending, confirmed, active, completed. Illegal moves are not offered. Cancel one and confirm the dates open up again.
Expected: all five behave as described. Note any failure and fix before continuing.

- [ ] **Step 8: Commit**

```bash
git add src
git commit -m "Carry pick-up/drop-off context through search, detail and booking; fleet-size wording in admin"
```

---

### Task 9: Seed, contract migration, docs and rollout

**Files:**
- Create: `migrations/0007_contract_legacy.sql`, `tests/sql/05_contract.test.sql`
- Modify: `seed.ts`, `src/types/database.ts`, `README.md`

**Interfaces:**
- Consumes: the whole engine (Tasks 2 to 8).
- Produces: a database with no `locations` table, no `pickup_location_id`/`dropoff_location_id`, and no stock RPCs. `vehicles.location_id` is a home-branch hint referencing `branches`. `seed.ts` writes providers' branches, fleet units and bookings in the new shape.

- [ ] **Step 1: Write the failing test `tests/sql/05_contract.test.sql`**

```sql
select test.assert(to_regclass('public.locations') is null, 'locations table is dropped');
select test.assert(to_regprocedure('decrement_vehicle_stock(uuid)') is null, 'decrement_vehicle_stock is dropped');
select test.assert(to_regprocedure('increment_vehicle_stock(uuid)') is null, 'increment_vehicle_stock is dropped');
select test.assert(not exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'bookings'
    and column_name in ('pickup_location_id', 'dropoff_location_id')
), 'legacy booking location columns are dropped');
select test.assert((select confrelid::regclass::text from pg_constraint where conname = 'vehicles_location_id_fkey') = 'branches', 'vehicles.location_id references branches');
select test.assert((select count(*) from v_sales_by_country) >= 1, 'sales by country still works without locations');
select test.assert((select count(*) from v_best_sellers) >= 3, 'best sellers still works');
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:db -- 05`
Expected: `FAIL 05_contract.test.sql` with `ASSERT FAILED: locations table is dropped`.

- [ ] **Step 3: Create `migrations/0007_contract_legacy.sql`**

```sql
-- Contract step. Apply only AFTER the application code that no longer uses
-- locations, pickup_location_id/dropoff_location_id or the stock RPCs is deployed.

drop function if exists decrement_vehicle_stock(uuid);
drop function if exists increment_vehicle_stock(uuid);

alter table bookings
  drop column pickup_location_id,
  drop column dropoff_location_id;

-- vehicles.location_id stays as the catalogue "home branch" hint used when a
-- vehicle is created; branch ids equal the old location ids, so values are valid.
alter table vehicles drop constraint if exists vehicles_location_id_fkey;
alter table vehicles
  add constraint vehicles_location_id_fkey
  foreign key (location_id) references branches(id) on delete set null;

drop table locations;
```

- [ ] **Step 4: Run all SQL tests**

Run: `npm run test:db`
Expected: `5/5 SQL test files passed`.

- [ ] **Step 5: Clean up the types in `src/types/database.ts`**

- Delete the `locations` table entry and its `Relationships` reference on `vehicles`; change the `vehicles` relationship to `referencedRelation: "branches"`.
- Delete `pickup_location_id` and `dropoff_location_id` from `BookingRow`, from `bookings.Insert` and `bookings.Update`, and delete the two `bookings_*_location_id_fkey` relationships.
- Delete the `decrement_vehicle_stock` and `increment_vehicle_stock` entries from `Functions`.
Run: `npx tsc --noEmit`
Expected: no errors. If the compiler names any file still using `Tables<"locations">` or a removed column, fix that usage to `branches` or the `*_branch_id` column.

- [ ] **Step 6: Update `seed.ts`**

Add below the imports: `const DEFAULT_PROVIDER_ID = "00000000-0000-0000-0000-00000000b0c1";`

In `main()`:
- Replace `await supabase.from("locations").delete().neq("id", 0);` with
```ts
  // Vehicles delete cascades to fleet_units; bookings are already gone.
  await supabase.from("branches").delete().eq("provider_id", DEFAULT_PROVIDER_ID);
```
- Replace the "Inserting locations" block with
```ts
  console.log("Inserting branches...");
  const { data: insertedLocations, error: locError } = await supabase
    .from("branches")
    .insert(
      LOCATIONS.map((l, i) => ({
        provider_id: DEFAULT_PROVIDER_ID,
        code: `${l.country_code}-${i + 1}`,
        name: `${l.city} Branch`,
        city: l.city,
        country: l.country,
        country_code: l.country_code,
        currency: "USD",
      }))
    )
    .select();
  if (locError) throw locError;
```
- In `vehicleRows` change `stock: randomInt(1, 6),` to `stock: 0,` (units are created next and a trigger keeps `stock` in sync).
- After `console.log(\`Inserted ${insertedVehicles!.length} vehicles.\`);` add
```ts
  console.log("Inserting fleet units...");
  const unitRows = insertedVehicles!.flatMap((v) =>
    Array.from({ length: randomInt(1, 5) }, (_, i) => ({
      provider_id: DEFAULT_PROVIDER_ID,
      branch_id: v.location_id as number,
      vehicle_id: v.id as string,
      plate: `${String(v.slug).toUpperCase()}-${i + 1}`,
    }))
  );
  const { error: unitError } = await supabase.from("fleet_units").insert(unitRows);
  if (unitError) throw unitError;
```
- In the booking row object replace `pickup_location_id: pickupLoc.id, dropoff_location_id: dropoffLoc.id,` with
```ts
      provider_id: DEFAULT_PROVIDER_ID,
      pickup_branch_id: pickupLoc.id,
      dropoff_branch_id: dropoffLoc.id,
      currency: "USD",
```
- Replace `randomStatus` so seeded revenue uses the new statuses:
```ts
function randomStatus() {
  const roll = Math.random();
  if (roll < 0.72) return "completed";
  if (roll < 0.9) return "pending";
  return "cancelled";
}
```
- In the closing summary change `locations` to `branches`.
Seeded bookings are historic and intentionally have no `fleet_unit_id`.
Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Update `README.md`**

- Section 6: state that a fresh database is built by running `schema.sql`, then every file in `migrations/` in order (`0001` to `0007`), then `npx tsx seed.ts`.
- Section 7, `POST /api/bookings`: replace `pickup_location_id`, `dropoff_location_id` with `pickup_branch_id`, `dropoff_branch_id` (optional; default to the vehicle's home branch, and drop-off defaults to pick-up). Add: returns `409` when no unit is free for the dates.
- Section 7, `GET /api/bookings` and `PATCH /api/bookings/[id]`: statuses are `pending`, `confirmed`, `active`, `completed`, `cancelled`, `no_show`. List the allowed transitions: pending to confirmed or cancelled, confirmed to active, cancelled or no_show, active to completed. Illegal moves return `409`.
- Section 7, `GET /api/vehicles`: document `pickupLocationId`, `dropoffLocationId`, `pickupDate`, `dropoffDate` (availability search) alongside the existing filters.
- Section 10: add a short "Availability" entry: date-based availability comes from an exclusion constraint on `unit_occupancy` (double booking is impossible at the database level), branches replace locations, and providers/fleet units are the foundation for the marketplace roadmap in `docs/superpowers/specs/`.
- Sections 9 and 10 or 11 mention "success" bookings anywhere: change to "completed/confirmed".

- [ ] **Step 8: Commit the code**

```bash
git add migrations tests src seed.ts README.md
git commit -m "Contract legacy locations and stock objects; update seed and docs for the marketplace model"
```

- [ ] **Step 9: Rollout runbook (production Supabase and Vercel)**

Do these in order; stop and investigate on any surprise.
1. Back up production (Supabase dashboard, Database, Backups, or `pg_dump`). Confirm the backup exists before continuing.
2. Rehearse on a restored copy or a Supabase branch: apply `migrations/0003` to `0006`. Read every `WARNING: booking ... could not be assigned a unit` line (these are future bookings that stay unassigned). Check row counts: `select count(*) from branches` equals the old `locations` count, `select count(*) from fleet_units` is at least the old vehicle count, and `select status, count(*) from bookings group by 1` shows no `success`.
3. Apply `0003` to `0006` to production, then deploy the new application immediately (push to `main` so Vercel deploys). Between these two steps the old code still books through the old stock RPCs (they still exist until `0007`), but the admin bookings table shows blank labels for the renamed statuses. Keep the gap short.
4. Smoke test production: search with dates, book, see the booking in `/admin/bookings`, move it through statuses, cancel it.
5. After at least a day with no errors, apply `0007` (drops `locations`, old columns and old stock functions). Do not run `schema.sql` against production; it drops tables.
6. Rollback plan: before `0007`, redeploy the previous Vercel build (still compatible with the database except for the status labels). After `0007` a rollback needs the backup.

- [ ] **Step 10: Final verification**

Run: `npx tsc --noEmit; npm run lint; npx vitest run; npm run test:db`
Expected: no type or lint errors, all vitest tests pass, `5/5 SQL test files passed`.
Run `npm run build` with the staging Supabase variables in `.env.local`.
Expected: build succeeds.

---

## Self-review (against the spec)

**Spec coverage (sections 3 and 5b):**
- providers, provider_members, roles, RLS on `provider_id`: Task 2, and Task 3 for fleet tables.
- branches replacing locations, currency, turnaround buffer: Tasks 2, 5, 9. Opening hours and timezone are stored but not used yet.
- vehicles as catalogue, fleet_units: Task 3.
- availability_windows and owner opt-in, instant-book vs approve-first: windows are enforced (Task 5). The instant-book flag is a provider-portal setting and is deferred to sub-project 4 (bookings start `pending` and staff confirm).
- unit_occupancy exclusion constraint with buffer: Tasks 3 and 5.
- one-way rentals with unit transfer: Tasks 4 and 5 (`unit_branch_at`, chain check, relocation on completion).
- booking states and a single transition function: Tasks 4 and 6.
- migration from stock counters, with existing bookings kept: Tasks 2 to 5 and 9.
- Marketplace RLS: enforced in SQL and tested for anon, member, agent and stranger.
- Portals (5b): provider portal, customer account and platform admin UIs are sub-projects 4, 5 and 8. This plan only lays their data and RLS foundation.

**Known limitations, by design:**
- Prices are still `price_per_day x days` in the app's currency-less numeric column (sub-project 2 replaces this).
- Availability search treats a date-only search as UTC midnight, and the booking panel sends local midnight. A search can show a vehicle that the booking then rejects by a few hours at the edges.
- `vehicles.available` stays an admin listing toggle; `vehicles.stock` now means the number of active units.
- The vehicle-id filter uses an `in` list. Move it into SQL if the catalogue grows past a few thousand models.
- Concurrent booking races are resolved by the exclusion constraint plus the retry loop in `create_booking_atomic`. The SQL suite tests sequential behaviour only. A two-connection concurrency test is a good follow-up.
- Historic bookings have no `fleet_unit_id`, which is intended.

**Type consistency:** function names and signatures match across tasks: `free_units`, `available_vehicle_ids`, `create_booking_atomic`, `transition_booking`, `unit_branch_at`, `toBookingApiError`, `nextStatuses`, `BOOKING_STATUS_OPTIONS`, `BranchOption`, `resolveVehicleIdFilter`. Error codes BC001 to BC004 and P0002 are defined once in the Global Constraints and used consistently.
