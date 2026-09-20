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
