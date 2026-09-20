-- Pricing configuration for the quote engine (sub-project 2).
-- All money is integer minor units. Provider-scoped tables carry provider_id and
-- use the same RLS pattern as the fleet tables: members read, owners and managers write.
-- Platform-level tables (platform_settings, tax_rules) have RLS on and no policies:
-- they are read only by the server through the service role.

create table platform_settings (
  id             boolean primary key default true check (id),  -- singleton row
  commission_bp  int not null default 1500 check (commission_bp between 0 and 10000),
  service_fee_bp int not null default 0    check (service_fee_bp between 0 and 10000)
);
insert into platform_settings default values;
alter table platform_settings enable row level security;

alter table branches
  add column pickup_surcharge_minor int not null default 0 check (pickup_surcharge_minor >= 0);

create table rate_plans (
  id                  uuid primary key default gen_random_uuid(),
  provider_id         uuid not null,
  vehicle_id          uuid not null references vehicles(id) on delete cascade,
  branch_id           int  not null,
  currency            char(3) not null,
  base_daily_minor    bigint not null check (base_daily_minor > 0),
  weekend_uplift_bp   int not null default 0 check (weekend_uplift_bp between 0 and 10000),
  weekly_discount_bp  int not null default 0 check (weekly_discount_bp between 0 and 10000),
  monthly_discount_bp int not null default 0 check (monthly_discount_bp between 0 and 10000),
  min_days            int not null default 1 check (min_days >= 1),
  max_days            int check (max_days is null or max_days >= min_days),
  included_km_per_day int check (included_km_per_day is null or included_km_per_day > 0),
  extra_km_minor      bigint check (extra_km_minor is null or extra_km_minor >= 0),
  created_at          timestamptz not null default now(),
  foreign key (branch_id, provider_id) references branches (id, provider_id) on delete cascade,
  unique (vehicle_id, branch_id),
  unique (id, provider_id)
);

-- A plan is priced in its branch currency.
create or replace function check_rate_plan_currency() returns trigger
language plpgsql as $$
begin
  if new.currency <> (select currency from branches where id = new.branch_id) then
    raise exception 'rate plan currency % does not match the branch currency', new.currency
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger rate_plans_currency_check
  before insert or update of currency, branch_id on rate_plans
  for each row execute function check_rate_plan_currency();

create table rate_seasons (
  id           uuid primary key default gen_random_uuid(),
  rate_plan_id uuid not null,
  provider_id  uuid not null,
  during       daterange not null
    check (not isempty(during) and lower(during) is not null and upper(during) is not null),
  daily_minor  bigint not null check (daily_minor > 0),
  foreign key (rate_plan_id, provider_id) references rate_plans (id, provider_id) on delete cascade,
  exclude using gist (rate_plan_id with =, during with &&)
);

create table extras (
  id               uuid primary key default gen_random_uuid(),
  provider_id      uuid not null references providers(id) on delete cascade,
  code             text not null,
  name             text not null,
  kind             text not null check (kind in ('extra', 'insurance')),
  pricing          text not null check (pricing in ('per_day', 'per_rental')),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  currency         char(3) not null,
  max_quantity     int not null default 1 check (max_quantity >= 1),
  cap_minor        bigint check (cap_minor is null or cap_minor >= 0),
  is_mandatory     boolean not null default false,
  is_active        boolean not null default true,
  unique (provider_id, code)
);

-- Amounts are in the provider's default currency.
create table provider_policies (
  provider_id           uuid primary key references providers(id) on delete cascade,
  deposit_type          text not null default 'fixed' check (deposit_type in ('fixed', 'percent')),
  deposit_value         bigint not null default 0 check (deposit_value >= 0),
  cancellation_tiers    jsonb not null default '[]'::jsonb,
  min_driver_age        int not null default 21 check (min_driver_age >= 16),
  young_driver_age      int check (young_driver_age is null or young_driver_age > 16),
  young_driver_fee_minor bigint not null default 0 check (young_driver_fee_minor >= 0)
);

create table one_way_fees (
  provider_id    uuid not null,
  from_branch_id int  not null,
  to_branch_id   int  not null,
  amount_minor   bigint not null check (amount_minor >= 0),
  primary key (from_branch_id, to_branch_id),
  foreign key (from_branch_id, provider_id) references branches (id, provider_id) on delete cascade,
  foreign key (to_branch_id, provider_id)   references branches (id, provider_id) on delete cascade
);

create table tax_rules (
  id           uuid primary key default gen_random_uuid(),
  country_code char(2) not null,
  name         text not null,
  rate_bp      int not null check (rate_bp between 0 and 10000),
  applies_to   text[] not null
    check (cardinality(applies_to) > 0 and applies_to <@ array['rental', 'extras', 'fees']),
  inclusive    boolean not null default false,
  is_active    boolean not null default true
);
alter table tax_rules enable row level security;

create table promo_codes (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,
  issuer        text not null check (issuer in ('platform', 'provider')),
  provider_id   uuid references providers(id) on delete cascade,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  value         bigint not null check (value > 0),
  currency      char(3),
  valid_during  tstzrange,
  min_days      int not null default 1 check (min_days >= 1),
  vehicle_id    uuid references vehicles(id) on delete cascade,
  is_active     boolean not null default true,
  check ((issuer = 'provider') = (provider_id is not null)),
  check (
    (discount_type = 'percent' and value <= 10000 and currency is null)
    or (discount_type = 'fixed' and currency is not null)
  )
);
create unique index promo_codes_code_key on promo_codes (lower(code));

-- ---------------------------------------------------------------
-- Backfill: one rate plan per (vehicle, branch with units), equal to the
-- current catalogue price, so behaviour is unchanged on day one.
-- ---------------------------------------------------------------
insert into rate_plans (provider_id, vehicle_id, branch_id, currency, base_daily_minor)
select distinct on (u.vehicle_id, u.branch_id)
       u.provider_id, u.vehicle_id, u.branch_id, b.currency,
       greatest(1, round(v.price_per_day * case b.currency when 'JPY' then 1 else 100 end))::bigint
from fleet_units u
join branches b on b.id = u.branch_id
join vehicles v on v.id = u.vehicle_id;

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
alter table rate_plans        enable row level security;
alter table rate_seasons      enable row level security;
alter table extras            enable row level security;
alter table provider_policies enable row level security;
alter table one_way_fees      enable row level security;
alter table promo_codes       enable row level security;

create policy "members read rate plans" on rate_plans for select using (is_provider_member(provider_id));
create policy "owners and managers write rate plans" on rate_plans for all
  using (is_provider_member(provider_id, array['owner', 'manager']))
  with check (is_provider_member(provider_id, array['owner', 'manager']));

create policy "members read seasons" on rate_seasons for select using (is_provider_member(provider_id));
create policy "owners and managers write seasons" on rate_seasons for all
  using (is_provider_member(provider_id, array['owner', 'manager']))
  with check (is_provider_member(provider_id, array['owner', 'manager']));

create policy "members read extras" on extras for select using (is_provider_member(provider_id));
create policy "owners and managers write extras" on extras for all
  using (is_provider_member(provider_id, array['owner', 'manager']))
  with check (is_provider_member(provider_id, array['owner', 'manager']));

create policy "members read policies" on provider_policies for select using (is_provider_member(provider_id));
create policy "owners write policies" on provider_policies for all
  using (is_provider_member(provider_id, array['owner']))
  with check (is_provider_member(provider_id, array['owner']));

create policy "members read one-way fees" on one_way_fees for select using (is_provider_member(provider_id));
create policy "owners and managers write one-way fees" on one_way_fees for all
  using (is_provider_member(provider_id, array['owner', 'manager']))
  with check (is_provider_member(provider_id, array['owner', 'manager']));

-- Platform promos are managed by the server; provider promos by their staff.
create policy "members read own promos" on promo_codes
  for select using (issuer = 'provider' and is_provider_member(provider_id));
create policy "owners and managers write own promos" on promo_codes for all
  using (issuer = 'provider' and is_provider_member(provider_id, array['owner', 'manager']))
  with check (issuer = 'provider' and is_provider_member(provider_id, array['owner', 'manager']));

-- ---------------------------------------------------------------
-- Bookings: billable-days rule and the immutable price snapshot.
-- ---------------------------------------------------------------
alter table bookings drop column days;
alter table bookings add column days int generated always as (
  greatest(1, ceil((extract(epoch from (dropoff_at - pickup_at)) - 3540) / 86400.0)::int)
) stored;

alter table bookings add column price_snapshot jsonb;

-- create_booking_atomic gains p_price_snapshot (stored in the same transaction).
drop function create_booking_atomic(uuid, int, int, timestamptz, timestamptz, text, text, numeric, text, text, text, text, uuid, uuid);

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
  p_user_id uuid default null,
  p_price_snapshot jsonb default null
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
        guest_id, user_id, provider_id, fleet_unit_id, pickup_branch_id, dropoff_branch_id, currency,
        price_snapshot
      ) values (
        p_reference, p_vehicle_id, p_customer_name, p_email, p_phone,
        p_pickup_at, p_dropoff_at, p_total_amount, p_payment_method, 'pending', p_source,
        p_guest_id, p_user_id, v_provider, cand.unit_id, p_pickup_branch_id, p_dropoff_branch_id, v_currency,
        p_price_snapshot
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

revoke all on function create_booking_atomic(uuid, int, int, timestamptz, timestamptz, text, text, numeric, text, text, text, text, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function create_booking_atomic(uuid, int, int, timestamptz, timestamptz, text, text, numeric, text, text, text, text, uuid, uuid, jsonb) to service_role;
