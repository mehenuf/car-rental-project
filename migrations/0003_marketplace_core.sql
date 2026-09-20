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
