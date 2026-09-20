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
