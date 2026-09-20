-- Customer account and trust (sub-project 5).
-- Driver's licence profiles and documents, receipts with gapless numbering, claiming guest
-- bookings, and a licence and age gate on vehicle pickup. Expand-only: nothing here removes or
-- renames an existing column, so the previous release keeps working until it is replaced.
--
-- Not included (deferred, see the plan): self-service booking changes. A change moves money
-- (supplements and partial refunds), which the ledger and payout maths built in 0009 do not yet
-- model, so it needs its own design rather than a shortcut here.

-- ---------------------------------------------------------------
-- Driver profiles and documents
-- ---------------------------------------------------------------
create table driver_profiles (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  date_of_birth        date,
  licence_country      char(2),
  licence_number_last4 text check (licence_number_last4 is null or licence_number_last4 ~ '^[A-Za-z0-9]{4}$'),
  licence_expiry       date,
  status               text not null default 'unverified'
    check (status in ('unverified', 'pending', 'verified', 'rejected', 'expired')),
  review_note          text,
  submitted_at         timestamptz,
  reviewed_at          timestamptz,
  reviewed_by          uuid references auth.users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- A profile cannot be pending or verified without the details a reviewer needs.
  check (status in ('unverified', 'rejected', 'expired')
         or (date_of_birth is not null and licence_country is not null
             and licence_number_last4 is not null and licence_expiry is not null))
);
create index driver_profiles_review_idx on driver_profiles(submitted_at) where status = 'pending';

create table driver_documents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('licence_front', 'licence_back', 'selfie')),
  storage_path text not null unique,
  mime_type    text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes   int  not null check (size_bytes > 0 and size_bytes <= 5242880),
  created_at   timestamptz not null default now(),
  check (kind <> 'selfie' or mime_type <> 'application/pdf')
);
create index driver_documents_user_idx on driver_documents(user_id);

-- Customers reach these tables only through server routes (service role); no policies means
-- browsers, even signed in, read and write nothing.
alter table driver_profiles  enable row level security;
alter table driver_documents enable row level security;

-- ---------------------------------------------------------------
-- Receipts: one per succeeded charge, numbered R-YYYY-000001, gapless per year
-- ---------------------------------------------------------------
create table receipt_counters (
  year int primary key,
  last int not null default 0
);

create table receipts (
  id         uuid primary key default gen_random_uuid(),
  number     text not null unique,
  booking_id uuid not null references bookings(id),
  payment_id uuid not null unique references payments(id),
  issued_at  timestamptz not null default now(),
  snapshot   jsonb not null
);
create index receipts_booking_idx on receipts(booking_id);

alter table receipt_counters enable row level security;
alter table receipts         enable row level security;

create or replace function issue_receipt(p_payment_id uuid) returns receipts
language plpgsql as $$
declare
  pay payments;
  b bookings;
  r receipts;
  v_year int := extract(year from now())::int;
  v_seq int;
begin
  select * into r from receipts where payment_id = p_payment_id;
  if found then return r; end if;

  select * into pay from payments where id = p_payment_id;
  if not found then
    raise exception 'payment % not found', p_payment_id using errcode = 'P0002';
  end if;
  if pay.kind <> 'charge' or pay.status <> 'succeeded' then
    raise exception 'a receipt is issued only for a succeeded charge' using errcode = 'BA001';
  end if;
  select * into b from bookings where id = pay.booking_id;

  -- The counter row is locked for the rest of the transaction, so numbers cannot skip or repeat.
  insert into receipt_counters (year, last) values (v_year, 1)
  on conflict (year) do update set last = receipt_counters.last + 1
  returning last into v_seq;

  insert into receipts (number, booking_id, payment_id, snapshot)
  values (
    'R-' || v_year || '-' || lpad(v_seq::text, 6, '0'),
    b.id, pay.id,
    jsonb_build_object(
      'reference', b.reference,
      'customerName', b.customer_name,
      'email', b.email,
      'currency', pay.currency,
      'amountMinor', pay.amount_minor,
      'method', pay.method,
      'pickupAt', b.pickup_at,
      'dropoffAt', b.dropoff_at,
      'quote', b.price_snapshot -> 'quote'
    )
  )
  returning * into r;
  return r;
end $$;

-- ---------------------------------------------------------------
-- Claiming guest bookings (the email must be a verified account email)
-- ---------------------------------------------------------------
create table guest_claims (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  booking_id uuid not null unique references bookings(id) on delete cascade,
  claimed_at timestamptz not null default now()
);
alter table guest_claims enable row level security;

create or replace function claim_guest_bookings(p_user_id uuid, p_email text) returns int
language plpgsql as $$
declare
  v_count int;
begin
  if not exists (
    select 1 from auth.users u
    where u.id = p_user_id and lower(u.email) = lower(trim(p_email)) and u.email_confirmed_at is not null
  ) then
    raise exception 'the email must belong to this account and be verified' using errcode = 'BA002';
  end if;

  with claimed as (
    update bookings
    set user_id = p_user_id
    where user_id is null and lower(email) = lower(trim(p_email))
    returning id
  ), logged as (
    insert into guest_claims (user_id, booking_id)
    select p_user_id, id from claimed
    returning 1
  )
  select count(*) into v_count from logged;
  return v_count;
end $$;

-- ---------------------------------------------------------------
-- Pickup gate: a verified licence, valid through the return date, and old enough
-- ---------------------------------------------------------------
alter table booking_inspections add column licence_override_reason text;

drop function record_inspection(uuid, text, int, text, text, text[], uuid);

create or replace function record_inspection(
  p_booking_id uuid,
  p_kind text,
  p_odometer_km int,
  p_fuel_level text,
  p_notes text,
  p_photo_paths text[],
  p_user_id uuid,
  p_override_reason text default null
) returns bookings
language plpgsql as $$
declare
  b bookings;
  v_pickup_odometer int;
  v_override text := nullif(btrim(coalesce(p_override_reason, '')), '');
  dp driver_profiles;
  v_tz text;
  v_min_age int;
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

  if p_kind = 'pickup' and v_override is null then
    select * into dp from driver_profiles where user_id = b.user_id;
    if b.user_id is null or not found or dp.status <> 'verified' then
      raise exception 'the renter has no verified driver''s licence' using errcode = 'BP008';
    end if;
    select coalesce(br.timezone, 'UTC') into v_tz from branches br where br.id = b.pickup_branch_id;
    if dp.licence_expiry < (b.dropoff_at at time zone coalesce(v_tz, 'UTC'))::date then
      raise exception 'the driver''s licence expires before the rental ends' using errcode = 'BP009';
    end if;
    select min_driver_age into v_min_age from provider_policies where provider_id = b.provider_id;
    if dp.date_of_birth is null
       or date_part('year', age((b.pickup_at at time zone coalesce(v_tz, 'UTC'))::date, dp.date_of_birth)) < coalesce(v_min_age, 21) then
      raise exception 'the renter is under the minimum driver age' using errcode = 'BP010';
    end if;
  end if;

  if p_kind = 'return' then
    select odometer_km into v_pickup_odometer from booking_inspections where booking_id = b.id and kind = 'pickup';
    if v_pickup_odometer is not null and p_odometer_km < v_pickup_odometer then
      raise exception 'return odometer is lower than the pickup odometer' using errcode = 'BP007';
    end if;
  end if;

  insert into booking_inspections (
    booking_id, provider_id, kind, odometer_km, fuel_level, notes, photo_paths, created_by, licence_override_reason
  ) values (
    b.id, b.provider_id, p_kind, p_odometer_km, p_fuel_level, p_notes, coalesce(p_photo_paths, '{}'), p_user_id,
    case when p_kind = 'pickup' then v_override end
  );

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

-- ---------------------------------------------------------------
-- Grants: everything above is service-role only
-- ---------------------------------------------------------------
revoke all on function issue_receipt(uuid) from public, anon, authenticated;
revoke all on function claim_guest_bookings(uuid, text) from public, anon, authenticated;
revoke all on function record_inspection(uuid, text, int, text, text, text[], uuid, text) from public, anon, authenticated;
grant execute on function issue_receipt(uuid) to service_role;
grant execute on function claim_guest_bookings(uuid, text) to service_role;
grant execute on function record_inspection(uuid, text, int, text, text, text[], uuid, text) to service_role;

-- ---------------------------------------------------------------
-- Private bucket for licence photos (only where the Storage schema exists)
-- ---------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('customer-documents', 'customer-documents', false)
    on conflict (id) do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------
-- Existing accounts count as verified, so turning on "Confirm email" cannot lock anyone out
-- ---------------------------------------------------------------
update auth.users set email_confirmed_at = now() where email_confirmed_at is null;
