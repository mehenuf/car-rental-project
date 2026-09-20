-- Provider onboarding and portal (sub-project 4).
-- Error codes: BP006 booking is not in the right state for this inspection,
-- BP007 return odometer is lower than the pickup odometer.

-- ---------------------------------------------------------------
-- Onboarding fields
-- ---------------------------------------------------------------
alter table providers
  add column registration_number text,
  add column contact_phone       text,
  add column submitted_at        timestamptz,
  add column reviewed_at         timestamptz,
  add column review_note         text;

-- ---------------------------------------------------------------
-- Address privacy: the exact address is readable by members only.
-- ---------------------------------------------------------------
create table branch_private (
  branch_id   int primary key,
  provider_id uuid not null,
  address     text,
  foreign key (branch_id, provider_id) references branches (id, provider_id) on delete cascade
);

insert into branch_private (branch_id, provider_id, address)
select id, provider_id, address from branches where address is not null;
alter table branches drop column address;

alter table branch_private enable row level security;
create policy "members read branch private" on branch_private
  for select using (is_provider_member(provider_id));
create policy "owners and managers write branch private" on branch_private for all
  using (is_provider_member(provider_id, array['owner', 'manager']))
  with check (is_provider_member(provider_id, array['owner', 'manager']));

-- ---------------------------------------------------------------
-- Per-car listing approval. Existing units are approved; the individual-owner
-- flow creates new cars as draft and an admin approves each one.
-- ---------------------------------------------------------------
alter table fleet_units
  add column listing_status text not null default 'approved'
    check (listing_status in ('draft', 'pending_review', 'approved', 'rejected')),
  add column review_note text;

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
    and u.listing_status = 'approved'
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

-- ---------------------------------------------------------------
-- Documents (files live in the private Storage bucket; this table is the index)
-- ---------------------------------------------------------------
create table provider_documents (
  id            uuid primary key default gen_random_uuid(),
  provider_id   uuid not null references providers(id) on delete cascade,
  fleet_unit_id uuid references fleet_units(id) on delete cascade,
  kind          text not null check (kind in
    ('business_licence', 'id_document', 'drivers_licence', 'vehicle_registration', 'insurance')),
  storage_path  text not null unique,
  file_name     text not null,
  mime_type     text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes    int  not null check (size_bytes > 0 and size_bytes <= 5242880),
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  review_note   text,
  created_at    timestamptz not null default now()
);
create index provider_documents_provider_idx on provider_documents(provider_id);

alter table provider_documents enable row level security;
create policy "members read documents" on provider_documents
  for select using (is_provider_member(provider_id));

-- ---------------------------------------------------------------
-- Payout account: masked details only (payouts are simulated)
-- ---------------------------------------------------------------
create table payout_accounts (
  provider_id    uuid primary key references providers(id) on delete cascade,
  account_holder text not null,
  bank_name      text not null,
  account_last4  char(4) not null check (account_last4 ~ '^[0-9]{4}$'),
  country_code   char(2) not null,
  updated_at     timestamptz not null default now()
);
alter table payout_accounts enable row level security;
create policy "owners and managers read payout account" on payout_accounts
  for select using (is_provider_member(provider_id, array['owner', 'manager']));

-- ---------------------------------------------------------------
-- Pickup and return inspections
-- ---------------------------------------------------------------
create table booking_inspections (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references bookings(id) on delete cascade,
  provider_id uuid not null references providers(id),
  kind        text not null check (kind in ('pickup', 'return')),
  odometer_km int  not null check (odometer_km >= 0),
  fuel_level  text not null check (fuel_level in ('empty', 'quarter', 'half', 'three_quarters', 'full')),
  notes       text,
  photo_paths text[] not null default '{}',
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (booking_id, kind)
);
create index booking_inspections_provider_idx on booking_inspections(provider_id);

alter table booking_inspections enable row level security;
create policy "members read inspections" on booking_inspections
  for select using (is_provider_member(provider_id));

-- Records an inspection and moves the booking along: pickup activates it,
-- return completes it (which also relocates the unit and creates the payout).
create or replace function record_inspection(
  p_booking_id uuid,
  p_kind text,
  p_odometer_km int,
  p_fuel_level text,
  p_notes text,
  p_photo_paths text[],
  p_user_id uuid
) returns bookings
language plpgsql as $$
declare
  b bookings;
  v_pickup_odometer int;
begin
  select * into b from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking % not found', p_booking_id using errcode = 'P0002';
  end if;
  if b.provider_id is null then
    raise exception 'booking has no provider' using errcode = 'BP006';
  end if;
  if (p_kind = 'pickup' and b.status <> 'confirmed') or (p_kind = 'return' and b.status <> 'active') then
    raise exception 'a % inspection is not possible for a % booking', p_kind, b.status using errcode = 'BP006';
  end if;

  if p_kind = 'return' then
    select odometer_km into v_pickup_odometer from booking_inspections where booking_id = b.id and kind = 'pickup';
    if v_pickup_odometer is not null and p_odometer_km < v_pickup_odometer then
      raise exception 'return odometer is lower than the pickup odometer' using errcode = 'BP007';
    end if;
  end if;

  insert into booking_inspections (booking_id, provider_id, kind, odometer_km, fuel_level, notes, photo_paths, created_by)
  values (b.id, b.provider_id, p_kind, p_odometer_km, p_fuel_level, p_notes, coalesce(p_photo_paths, '{}'), p_user_id);

  if p_kind = 'pickup' then
    b := transition_booking(b.id, 'active');
  else
    b := transition_booking(b.id, 'completed');
    if b.fleet_unit_id is not null then
      update fleet_units set mileage_km = greatest(mileage_km, p_odometer_km) where id = b.fleet_unit_id;
    end if;
  end if;
  return b;
end $$;

revoke all on function record_inspection(uuid, text, int, text, text, text[], uuid) from public, anon, authenticated;
grant execute on function record_inspection(uuid, text, int, text, text, text[], uuid) to service_role;

-- ---------------------------------------------------------------
-- Private Storage buckets (only where the Supabase Storage schema exists).
-- With no policies, only the service role can read or write them; the server
-- hands out short-lived signed URLs after checking membership.
-- ---------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('provider-documents', 'provider-documents', false),
           ('booking-inspections', 'booking-inspections', false)
    on conflict (id) do nothing;
  end if;
end $$;
