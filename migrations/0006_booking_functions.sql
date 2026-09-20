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
