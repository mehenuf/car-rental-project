-- Payments, an append-only double-entry ledger, provider payouts and unpaid-booking holds
-- (sub-project 3). All money is integer minor units. Every function here is callable by
-- the service role only; ledger and payment tables are never readable by customers.
--
-- Error codes: BC010 ledger/event tables are append-only, BC011 ledger transaction not
-- balanced, BP002 wrong payment kind, BP003 amount/snapshot problem, BP004 amount exceeds
-- what is available, BP005 invalid state for the operation, P0002 not found.

-- ---------------------------------------------------------------
-- Bookings: payment methods, payment status, hold and completion time
-- ---------------------------------------------------------------
alter table bookings drop constraint if exists bookings_payment_method_check;
alter table bookings add constraint bookings_payment_method_check check (
  payment_method is null or payment_method in
    ('paypal', 'stripe', 'apple_pay', 'payu', 'paytm', 'card', 'google_pay', 'ideal', 'upi', 'bkash', 'mpesa')
);

alter table bookings
  add column payment_status  text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'refunded', 'partially_refunded')),
  add column hold_expires_at timestamptz,
  add column completed_at    timestamptz;

-- Legacy "success" bookings were paid in the old model; they have no snapshot, so no ledger or payout.
update bookings set payment_status = 'paid' where status in ('confirmed', 'active', 'completed');
update bookings set completed_at = dropoff_at where status = 'completed';

-- ---------------------------------------------------------------
-- Payments and their event log
-- ---------------------------------------------------------------
create table payments (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null references bookings(id) on delete cascade,
  kind                text not null check (kind in ('charge', 'deposit_hold', 'refund')),
  method              text not null check (method in
    ('card', 'paypal', 'apple_pay', 'google_pay', 'ideal', 'upi', 'bkash', 'mpesa')),
  provider            text not null check (provider in ('stripe', 'simulated')),
  provider_ref        text,
  status              text not null default 'processing' check (status in
    ('requires_action', 'processing', 'succeeded', 'failed', 'cancelled', 'released', 'captured')),
  amount_minor        bigint not null check (amount_minor > 0),
  currency            char(3) not null,
  idempotency_key     text not null unique,
  failure_code        text,
  provider_part_minor bigint,           -- refunds: the share taken from the provider
  platform_part_minor bigint,           -- refunds: the share taken from the platform
  captured_minor      bigint,           -- deposits: amount captured
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index payments_booking_idx on payments(booking_id);
create unique index payments_provider_ref_key on payments(provider, provider_ref) where provider_ref is not null;

create table payment_events (
  id         bigint generated always as identity primary key,
  payment_id uuid not null references payments(id) on delete cascade,
  type       text not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index payment_events_payment_idx on payment_events(payment_id);

-- ---------------------------------------------------------------
-- Ledger: double-entry, append-only, balanced per transaction
-- ---------------------------------------------------------------
create table ledger_accounts (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,
  provider_id uuid references providers(id),
  kind        text not null check (kind in ('asset', 'liability', 'income', 'expense')),
  unique nulls not distinct (code, provider_id)
);

-- booking_id is deliberately not a foreign key: ledger history must outlive any booking row.
create table ledger_transactions (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid,
  kind            text not null,
  memo            text,
  idempotency_key text not null unique,
  created_at      timestamptz not null default now()
);
create index ledger_transactions_booking_idx on ledger_transactions(booking_id);

create table ledger_entries (
  id             bigint generated always as identity primary key,
  transaction_id uuid not null references ledger_transactions(id),
  account_id     uuid not null references ledger_accounts(id),
  direction      text not null check (direction in ('debit', 'credit')),
  amount_minor   bigint not null check (amount_minor > 0),
  currency       char(3) not null
);
create index ledger_entries_tx_idx on ledger_entries(transaction_id);
create index ledger_entries_account_idx on ledger_entries(account_id);

create or replace function append_only_guard() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = 'BC010';
end $$;

create trigger ledger_entries_append_only before update or delete on ledger_entries
  for each row execute function append_only_guard();
create trigger ledger_entries_no_truncate before truncate on ledger_entries
  for each statement execute function append_only_guard();
create trigger ledger_transactions_append_only before update or delete on ledger_transactions
  for each row execute function append_only_guard();
create trigger ledger_transactions_no_truncate before truncate on ledger_transactions
  for each statement execute function append_only_guard();
create trigger payment_events_append_only before update or delete on payment_events
  for each row execute function append_only_guard();

-- Backstop: whatever inserts entries, every transaction must balance per currency at commit.
create or replace function check_ledger_balanced() returns trigger
language plpgsql as $$
begin
  if exists (
    select 1 from ledger_entries
    where transaction_id = new.transaction_id
    group by currency
    having sum(case direction when 'debit' then amount_minor else -amount_minor end) <> 0
  ) then
    raise exception 'ledger transaction % is not balanced', new.transaction_id using errcode = 'BC011';
  end if;
  return null;
end $$;

create constraint trigger ledger_entries_balanced
  after insert on ledger_entries
  deferrable initially deferred
  for each row execute function check_ledger_balanced();

create or replace function ledger_account(p_code text, p_provider_id uuid, p_kind text) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  select id into v_id from ledger_accounts where code = p_code and provider_id is not distinct from p_provider_id;
  if v_id is null then
    insert into ledger_accounts (code, provider_id, kind) values (p_code, p_provider_id, p_kind)
    on conflict (code, provider_id) do nothing;
    select id into v_id from ledger_accounts where code = p_code and provider_id is not distinct from p_provider_id;
  end if;
  return v_id;
end $$;

-- p_lines: [{"account": "psp_cash", "account_kind": "asset", "provider_id": null,
--            "direction": "debit", "amount_minor": 100}, ...]. Idempotent on p_key.
create or replace function post_ledger(
  p_booking_id uuid, p_kind text, p_key text, p_memo text, p_currency char(3), p_lines jsonb
) returns uuid
language plpgsql as $$
declare
  v_tx uuid;
  v_debit bigint := 0;
  v_credit bigint := 0;
  l jsonb;
begin
  select id into v_tx from ledger_transactions where idempotency_key = p_key;
  if found then return v_tx; end if;

  for l in select * from jsonb_array_elements(p_lines) loop
    if l ->> 'direction' = 'debit' then
      v_debit := v_debit + (l ->> 'amount_minor')::bigint;
    else
      v_credit := v_credit + (l ->> 'amount_minor')::bigint;
    end if;
  end loop;
  if v_debit = 0 or v_debit <> v_credit then
    raise exception 'unbalanced ledger transaction % (debit %, credit %)', p_key, v_debit, v_credit using errcode = 'BC011';
  end if;

  insert into ledger_transactions (booking_id, kind, memo, idempotency_key)
  values (p_booking_id, p_kind, p_memo, p_key) returning id into v_tx;

  for l in select * from jsonb_array_elements(p_lines) loop
    insert into ledger_entries (transaction_id, account_id, direction, amount_minor, currency)
    values (
      v_tx,
      ledger_account(l ->> 'account', nullif(l ->> 'provider_id', '')::uuid, l ->> 'account_kind'),
      l ->> 'direction', (l ->> 'amount_minor')::bigint, p_currency
    );
  end loop;
  return v_tx;
end $$;

-- ---------------------------------------------------------------
-- Payouts
-- ---------------------------------------------------------------
create table payouts (
  id            uuid primary key default gen_random_uuid(),
  provider_id   uuid not null references providers(id),
  booking_id    uuid not null unique references bookings(id) on delete cascade,
  amount_minor  bigint not null check (amount_minor >= 0),
  currency      char(3) not null,
  status        text not null default 'pending' check (status in ('pending', 'paid', 'frozen', 'cancelled')),
  release_after timestamptz not null,
  paid_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index payouts_due_idx on payouts(release_after) where status = 'pending';

-- ---------------------------------------------------------------
-- Holds: unpaid pending bookings expire and free their unit
-- ---------------------------------------------------------------
create or replace function expire_stale_holds() returns int
language plpgsql as $$
declare v_count int;
begin
  with expired as (
    update bookings set status = 'cancelled'
    where status = 'pending' and payment_status = 'unpaid'
      and hold_expires_at is not null and hold_expires_at < now()
    returning id
  ), released as (
    delete from unit_occupancy where booking_id in (select id from expired) returning 1
  )
  select count(*) into v_count from expired;
  return v_count;
end $$;

-- ---------------------------------------------------------------
-- Payment lifecycle
-- ---------------------------------------------------------------
create or replace function record_payment_success(p_payment_id uuid) returns jsonb
language plpgsql as $$
declare
  pay payments;
  b bookings;
  q jsonb;
begin
  select * into pay from payments where id = p_payment_id for update;
  if not found then raise exception 'payment not found' using errcode = 'P0002'; end if;
  if pay.kind <> 'charge' then raise exception 'not a charge' using errcode = 'BP002'; end if;
  if pay.status = 'succeeded' then return jsonb_build_object('result', 'already_recorded'); end if;

  select * into b from bookings where id = pay.booking_id for update;
  if b.price_snapshot is null then
    raise exception 'booking has no price snapshot' using errcode = 'BP003';
  end if;
  q := b.price_snapshot -> 'quote';
  if pay.amount_minor <> (q ->> 'totalMinor')::bigint or pay.currency <> coalesce(b.currency, pay.currency) then
    raise exception 'payment amount does not match the quoted total' using errcode = 'BP003';
  end if;

  if b.status <> 'pending' then
    update payments set status = 'failed', failure_code = 'booking_unavailable', updated_at = now() where id = pay.id;
    return jsonb_build_object('result', 'booking_unavailable');
  end if;

  update payments set status = 'succeeded', updated_at = now() where id = pay.id;
  update bookings set payment_status = 'paid', payment_method = pay.method, hold_expires_at = null where id = b.id;
  perform transition_booking(b.id, 'confirmed');

  perform post_ledger(b.id, 'charge', 'charge:' || pay.id, 'Booking ' || b.reference, pay.currency, jsonb_build_array(
    jsonb_build_object('account', 'psp_cash', 'account_kind', 'asset', 'direction', 'debit',
                       'amount_minor', (q ->> 'totalMinor')::bigint),
    jsonb_build_object('account', 'provider_payable', 'account_kind', 'liability', 'provider_id', b.provider_id,
                       'direction', 'credit', 'amount_minor', (q ->> 'providerPayoutMinor')::bigint),
    jsonb_build_object('account', 'platform_revenue', 'account_kind', 'income', 'direction', 'credit',
                       'amount_minor', (q ->> 'platformRevenueMinor')::bigint)
  ));
  return jsonb_build_object('result', 'confirmed');
end $$;

create or replace function record_refund_success(p_payment_id uuid) returns jsonb
language plpgsql as $$
declare
  pay payments;
  b bookings;
  v_total bigint;
  v_payout bigint;
  v_refunded bigint;
  v_provider_part bigint;
  v_platform_part bigint;
  v_lines jsonb;
begin
  select * into pay from payments where id = p_payment_id for update;
  if not found then raise exception 'payment not found' using errcode = 'P0002'; end if;
  if pay.kind <> 'refund' then raise exception 'not a refund' using errcode = 'BP002'; end if;
  if pay.status = 'succeeded' then return jsonb_build_object('result', 'already_recorded'); end if;

  select * into b from bookings where id = pay.booking_id for update;
  if b.price_snapshot is null then
    raise exception 'booking has no price snapshot' using errcode = 'BP003';
  end if;
  v_total := (b.price_snapshot -> 'quote' ->> 'totalMinor')::bigint;
  v_payout := (b.price_snapshot -> 'quote' ->> 'providerPayoutMinor')::bigint;

  select coalesce(sum(amount_minor), 0) into v_refunded
  from payments where booking_id = b.id and kind = 'refund' and status = 'succeeded';
  if v_refunded + pay.amount_minor > v_total then
    raise exception 'refund exceeds what was paid' using errcode = 'BP004';
  end if;

  v_provider_part := round(pay.amount_minor::numeric * v_payout / v_total)::bigint;
  v_platform_part := pay.amount_minor - v_provider_part;

  update payments
  set status = 'succeeded', provider_part_minor = v_provider_part, platform_part_minor = v_platform_part, updated_at = now()
  where id = pay.id;

  v_lines := jsonb_build_array(
    jsonb_build_object('account', 'psp_cash', 'account_kind', 'asset', 'direction', 'credit', 'amount_minor', pay.amount_minor));
  if v_provider_part > 0 then
    v_lines := v_lines || jsonb_build_object('account', 'provider_payable', 'account_kind', 'liability',
      'provider_id', b.provider_id, 'direction', 'debit', 'amount_minor', v_provider_part);
  end if;
  if v_platform_part > 0 then
    v_lines := v_lines || jsonb_build_object('account', 'platform_revenue', 'account_kind', 'income',
      'direction', 'debit', 'amount_minor', v_platform_part);
  end if;
  perform post_ledger(b.id, 'refund', 'refund:' || pay.id, 'Refund for ' || b.reference, pay.currency, v_lines);

  update bookings
  set payment_status = case when v_refunded + pay.amount_minor = v_total then 'refunded' else 'partially_refunded' end
  where id = b.id;

  -- A payout that has not been paid yet shrinks by the provider's share of the refund.
  update payouts
  set amount_minor = greatest(0, amount_minor - v_provider_part),
      status = case when amount_minor - v_provider_part <= 0 then 'cancelled' else status end
  where booking_id = b.id and status = 'pending';

  return jsonb_build_object('result', 'recorded');
end $$;

-- ---------------------------------------------------------------
-- Deposits are authorizations: no ledger entries until (part of) one is captured.
-- ---------------------------------------------------------------
create or replace function record_deposit_hold(p_payment_id uuid) returns jsonb
language plpgsql as $$
declare pay payments;
begin
  select * into pay from payments where id = p_payment_id for update;
  if not found then raise exception 'payment not found' using errcode = 'P0002'; end if;
  if pay.kind <> 'deposit_hold' then raise exception 'not a deposit hold' using errcode = 'BP002'; end if;
  if pay.status = 'succeeded' then return jsonb_build_object('result', 'already_recorded'); end if;
  if pay.status not in ('processing', 'requires_action') then
    raise exception 'deposit hold is %', pay.status using errcode = 'BP005';
  end if;
  update payments set status = 'succeeded', updated_at = now() where id = pay.id;
  return jsonb_build_object('result', 'recorded');
end $$;

create or replace function release_deposit(p_payment_id uuid) returns jsonb
language plpgsql as $$
declare pay payments;
begin
  select * into pay from payments where id = p_payment_id for update;
  if not found then raise exception 'payment not found' using errcode = 'P0002'; end if;
  if pay.kind <> 'deposit_hold' then raise exception 'not a deposit hold' using errcode = 'BP002'; end if;
  if pay.status = 'released' then return jsonb_build_object('result', 'already_recorded'); end if;
  if pay.status <> 'succeeded' then raise exception 'deposit hold is %', pay.status using errcode = 'BP005'; end if;
  update payments set status = 'released', updated_at = now() where id = pay.id;
  return jsonb_build_object('result', 'released');
end $$;

-- Captured money is compensation for the provider (for example damage).
create or replace function capture_deposit(p_payment_id uuid, p_amount bigint) returns jsonb
language plpgsql as $$
declare
  pay payments;
  b bookings;
begin
  select * into pay from payments where id = p_payment_id for update;
  if not found then raise exception 'payment not found' using errcode = 'P0002'; end if;
  if pay.kind <> 'deposit_hold' then raise exception 'not a deposit hold' using errcode = 'BP002'; end if;
  if pay.status <> 'succeeded' then raise exception 'deposit hold is %', pay.status using errcode = 'BP005'; end if;
  if p_amount <= 0 or p_amount > pay.amount_minor then
    raise exception 'capture amount is outside the held amount' using errcode = 'BP004';
  end if;

  select * into b from bookings where id = pay.booking_id for update;
  update payments set status = 'captured', captured_minor = p_amount, updated_at = now() where id = pay.id;
  perform post_ledger(b.id, 'deposit_capture', 'deposit_capture:' || pay.id, 'Deposit captured for ' || b.reference,
    pay.currency, jsonb_build_array(
      jsonb_build_object('account', 'psp_cash', 'account_kind', 'asset', 'direction', 'debit', 'amount_minor', p_amount),
      jsonb_build_object('account', 'provider_payable', 'account_kind', 'liability', 'provider_id', b.provider_id,
                         'direction', 'credit', 'amount_minor', p_amount)));
  return jsonb_build_object('result', 'captured');
end $$;

-- ---------------------------------------------------------------
-- Payouts
-- ---------------------------------------------------------------
create or replace function create_payout_for_booking(p_booking_id uuid) returns uuid
language plpgsql as $$
declare
  b bookings;
  v_amount bigint;
  v_id uuid;
begin
  select * into b from bookings where id = p_booking_id;
  if not found or b.status <> 'completed' or b.payment_status not in ('paid', 'partially_refunded')
     or b.price_snapshot is null or b.provider_id is null then
    return null;
  end if;

  v_amount := (b.price_snapshot -> 'quote' ->> 'providerPayoutMinor')::bigint - coalesce((
    select sum(provider_part_minor) from payments
    where booking_id = b.id and kind = 'refund' and status = 'succeeded'), 0);
  if v_amount <= 0 then return null; end if;

  insert into payouts (provider_id, booking_id, amount_minor, currency, release_after)
  values (b.provider_id, b.id, v_amount, b.currency, b.completed_at + interval '48 hours')
  on conflict (booking_id) do nothing
  returning id into v_id;
  return v_id;
end $$;

-- Pays every due, unfrozen payout (a simulated bank transfer) and posts it to the ledger.
create or replace function run_payouts(p_now timestamptz default now()) returns int
language plpgsql as $$
declare
  p payouts;
  v_count int := 0;
begin
  for p in
    select * from payouts where status = 'pending' and release_after <= p_now
    order by release_after for update skip locked
  loop
    perform post_ledger(p.booking_id, 'payout', 'payout:' || p.id, 'Payout', p.currency, jsonb_build_array(
      jsonb_build_object('account', 'provider_payable', 'account_kind', 'liability', 'provider_id', p.provider_id,
                         'direction', 'debit', 'amount_minor', p.amount_minor),
      jsonb_build_object('account', 'provider_paid_out', 'account_kind', 'asset', 'provider_id', p.provider_id,
                         'direction', 'credit', 'amount_minor', p.amount_minor)));
    update payouts set status = 'paid', paid_at = p_now where id = p.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- ---------------------------------------------------------------
-- transition_booking: stamp completed_at and create the payout on completion
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

  update bookings
  set status = p_to,
      completed_at = case when p_to = 'completed' then now() else completed_at end
  where id = p_booking_id returning * into b;

  if p_to in ('cancelled', 'no_show') then
    delete from unit_occupancy where booking_id = b.id;
  elsif p_to = 'completed' then
    if b.fleet_unit_id is not null and b.dropoff_branch_id is not null then
      update fleet_units set branch_id = b.dropoff_branch_id where id = b.fleet_unit_id;
    end if;
    perform create_payout_for_booking(b.id);
  end if;

  return b;
end $$;

-- ---------------------------------------------------------------
-- create_booking_atomic: sweep stale holds first, and hold the new booking for 15 minutes
-- ---------------------------------------------------------------
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

  perform expire_stale_holds();

  for cand in
    select * from free_units(p_vehicle_id, p_pickup_branch_id, p_dropoff_branch_id, p_pickup_at, p_dropoff_at)
  loop
    begin
      select provider_id into v_provider from fleet_units where id = cand.unit_id;

      insert into bookings (
        reference, vehicle_id, customer_name, email, phone,
        pickup_at, dropoff_at, total_amount, payment_method, status, source,
        guest_id, user_id, provider_id, fleet_unit_id, pickup_branch_id, dropoff_branch_id, currency,
        price_snapshot, hold_expires_at
      ) values (
        p_reference, p_vehicle_id, p_customer_name, p_email, p_phone,
        p_pickup_at, p_dropoff_at, p_total_amount, p_payment_method, 'pending', p_source,
        p_guest_id, p_user_id, v_provider, cand.unit_id, p_pickup_branch_id, p_dropoff_branch_id, v_currency,
        p_price_snapshot, now() + interval '15 minutes'
      ) returning * into b;

      insert into unit_occupancy (fleet_unit_id, provider_id, reason, booking_id, during)
      values (cand.unit_id, v_provider, 'booking', b.id, tstzrange(p_pickup_at, p_dropoff_at + v_buffer, '[)'));

      return b;
    exception when exclusion_violation then
      continue;
    end;
  end loop;

  raise exception 'no vehicle available for the selected dates' using errcode = 'BC002';
end $$;

-- ---------------------------------------------------------------
-- RLS and privileges
-- ---------------------------------------------------------------
alter table payments            enable row level security;
alter table payment_events      enable row level security;
alter table ledger_accounts     enable row level security;
alter table ledger_transactions enable row level security;
alter table ledger_entries      enable row level security;
alter table payouts             enable row level security;

-- Only provider owners and managers see payouts; every other money table is server-only.
create policy "owners and managers read payouts" on payouts
  for select using (is_provider_member(provider_id, array['owner', 'manager']));

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'expire_stale_holds', 'record_payment_success', 'record_refund_success', 'record_deposit_hold',
      'release_deposit', 'capture_deposit', 'create_payout_for_booking', 'run_payouts',
      'post_ledger', 'ledger_account', 'append_only_guard', 'check_ledger_balanced')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
