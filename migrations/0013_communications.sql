-- Communications (sub-project 6): a transactional outbox, notifications over email, SMS and web
-- push, preferences and consent, a suppression list, and per-booking messages between customer
-- and provider. Expand-only: nothing existing is changed apart from new AFTER triggers.
--
-- Events are written by triggers in the same transaction as the change that caused them, so a
-- rolled-back change leaves no event and a crash cannot lose one. A dispatcher (application code)
-- turns events into per-channel notifications and sends them.

-- ---------------------------------------------------------------
-- Outbox and notifications
-- ---------------------------------------------------------------
create table outbox_events (
  id             uuid primary key default gen_random_uuid(),
  type           text not null,
  aggregate_type text not null,
  aggregate_id   uuid not null,
  payload        jsonb not null default '{}'::jsonb,
  locale         text not null default 'en',
  -- One event per business fact, however many times a trigger or cron fires.
  dedupe_key     text unique,
  run_at         timestamptz not null default now(),
  status         text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  attempts       int not null default 0,
  last_error     text,
  created_at     timestamptz not null default now(),
  processed_at   timestamptz
);
create index outbox_events_due_idx on outbox_events(run_at) where status = 'pending';

create table notifications (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid references outbox_events(id) on delete set null,
  channel           text not null check (channel in ('email', 'sms', 'push')),
  template          text not null,
  recipient_user_id uuid references auth.users(id) on delete set null,
  address           text not null,
  locale            text not null default 'en',
  payload           jsonb not null default '{}'::jsonb,
  status            text not null default 'queued'
    check (status in ('queued', 'sent', 'delivered', 'failed', 'suppressed', 'bounced')),
  provider          text,
  provider_ref      text,
  error             text,
  dedupe_key        text not null unique,
  attempts          int not null default 0,
  next_attempt_at   timestamptz not null default now(),
  sent_at           timestamptz,
  delivered_at      timestamptz,
  created_at        timestamptz not null default now()
);
create index notifications_due_idx on notifications(next_attempt_at) where status = 'queued';
create index notifications_provider_ref_idx on notifications(provider, provider_ref) where provider_ref is not null;

-- ---------------------------------------------------------------
-- Preferences, consent, suppression, push subscriptions
-- ---------------------------------------------------------------
create table notification_preferences (
  user_id  uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('reminders', 'messages')),
  channel  text not null check (channel in ('email', 'sms', 'push')),
  enabled  boolean not null,
  primary key (user_id, category, channel)
);

create table contact_channels (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  phone_e164        text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  phone_verified_at timestamptz,
  sms_opt_in        boolean not null default false,
  sms_opt_in_at     timestamptz,
  locale            text not null default 'en',
  timezone          text not null default 'UTC',
  -- SMS consent only counts with a verified phone.
  check (not sms_opt_in or phone_verified_at is not null)
);

create table suppressions (
  channel    text not null check (channel in ('email', 'sms', 'push')),
  address    text not null,
  reason     text not null check (reason in ('bounce', 'complaint', 'opt_out')),
  created_at timestamptz not null default now(),
  primary key (channel, address)
);

create table push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  locale       text not null default 'en',
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
create index push_subscriptions_user_idx on push_subscriptions(user_id);

-- ---------------------------------------------------------------
-- Messages between customer and provider, one thread per booking
-- ---------------------------------------------------------------
create table message_threads (
  id               uuid primary key default gen_random_uuid(),
  booking_id       uuid not null unique references bookings(id) on delete cascade,
  customer_user_id uuid references auth.users(id) on delete set null,
  provider_id      uuid not null references providers(id) on delete cascade,
  created_at       timestamptz not null default now(),
  last_message_at  timestamptz not null default now()
);
create index message_threads_customer_idx on message_threads(customer_user_id);
create index message_threads_provider_idx on message_threads(provider_id);

create table messages (
  id             uuid primary key default gen_random_uuid(),
  thread_id      uuid not null references message_threads(id) on delete cascade,
  sender_side    text not null check (sender_side in ('customer', 'provider', 'platform')),
  sender_user_id uuid references auth.users(id) on delete set null,
  body           text not null check (length(btrim(body)) between 1 and 2000),
  flagged        boolean not null default false,
  created_at     timestamptz not null default now(),
  read_at        timestamptz
);
create index messages_thread_idx on messages(thread_id, created_at);

alter table outbox_events            enable row level security;
alter table notifications            enable row level security;
alter table notification_preferences enable row level security;
alter table contact_channels         enable row level security;
alter table suppressions             enable row level security;
alter table push_subscriptions       enable row level security;
alter table message_threads          enable row level security;
alter table messages                 enable row level security;

-- Only the two parties of a thread read it; writes go through server routes that moderate first.
create policy "customer reads own thread" on message_threads
  for select using (customer_user_id = auth.uid());
create policy "provider members read their threads" on message_threads
  for select using (is_provider_member(provider_id));
create policy "thread parties read messages" on messages
  for select using (exists (
    select 1 from message_threads t
    where t.id = messages.thread_id and (t.customer_user_id = auth.uid() or is_provider_member(t.provider_id))
  ));

-- ---------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------
create or replace function enqueue_event(
  p_type text,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_payload jsonb default '{}'::jsonb,
  p_dedupe_key text default null,
  p_run_at timestamptz default now(),
  p_locale text default 'en'
) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into outbox_events (type, aggregate_type, aggregate_id, payload, dedupe_key, run_at, locale)
  values (p_type, p_aggregate_type, p_aggregate_id, coalesce(p_payload, '{}'::jsonb), p_dedupe_key, p_run_at, p_locale)
  on conflict (dedupe_key) do nothing
  returning id into v_id;
  return v_id;
end $$;

-- Hands out due events to one dispatcher at a time. The lease pushes run_at forward, so a
-- dispatcher that crashes leaves the event to be picked up again in five minutes.
create or replace function claim_pending_events(p_limit int default 20) returns setof outbox_events
language sql as $$
  with due as (
    select id from outbox_events
    where status = 'pending' and run_at <= now()
    order by run_at
    limit p_limit
    for update skip locked
  )
  update outbox_events e
  set attempts = e.attempts + 1, run_at = now() + interval '5 minutes'
  from due
  where e.id = due.id
  returning e.*;
$$;

create or replace function claim_due_notifications(p_limit int default 20) returns setof notifications
language sql as $$
  with due as (
    select id from notifications
    where status = 'queued' and next_attempt_at <= now()
    order by next_attempt_at
    limit p_limit
    for update skip locked
  )
  update notifications n
  set attempts = n.attempts + 1, next_attempt_at = now() + interval '5 minutes'
  from due
  where n.id = due.id
  returning n.*;
$$;

-- Email addresses of a provider's owners and managers (the auth schema is not exposed to the API).
create or replace function provider_recipients(p_provider_id uuid) returns table (user_id uuid, email text)
language sql stable security definer set search_path = public, auth as $$
  select m.user_id, u.email
  from provider_members m join auth.users u on u.id = m.user_id
  where m.provider_id = p_provider_id and m.role in ('owner', 'manager') and u.email is not null;
$$;

-- Reminder events for confirmed, paid bookings whose pickup is within the next 24 hours.
create or replace function enqueue_due_reminders(p_now timestamptz default now()) returns int
language plpgsql as $$
declare
  b record;
  v_count int := 0;
begin
  for b in
    select id, reference, user_id, email, customer_name, pickup_at, provider_id
    from bookings
    where status = 'confirmed' and payment_status in ('paid', 'partially_refunded')
      and pickup_at > p_now and pickup_at <= p_now + interval '24 hours'
  loop
    if enqueue_event('pickup_reminder', 'booking', b.id,
        jsonb_build_object('reference', b.reference, 'user_id', b.user_id, 'email', b.email,
                           'name', b.customer_name, 'pickup_at', b.pickup_at),
        'pickup_reminder:' || b.id) is not null then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;

-- ---------------------------------------------------------------
-- Triggers: events are written in the same transaction as the change
-- ---------------------------------------------------------------
create or replace function bookings_emit_events() returns trigger
language plpgsql as $$
declare
  v_payload jsonb := jsonb_build_object(
    'reference', new.reference, 'user_id', new.user_id, 'email', new.email, 'name', new.customer_name,
    'provider_id', new.provider_id, 'pickup_at', new.pickup_at, 'dropoff_at', new.dropoff_at,
    'total_amount', new.total_amount, 'currency', new.currency);
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    perform enqueue_event('booking_confirmed', 'booking', new.id, v_payload, 'booking_confirmed:' || new.id);
    if new.provider_id is not null then
      perform enqueue_event('new_booking', 'booking', new.id, v_payload, 'new_booking:' || new.id);
    end if;
  end if;
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' and old.payment_status in ('paid', 'partially_refunded') then
    perform enqueue_event('booking_cancelled', 'booking', new.id, v_payload, 'booking_cancelled:' || new.id);
    if new.provider_id is not null then
      perform enqueue_event('booking_cancelled_provider', 'booking', new.id, v_payload, 'booking_cancelled_provider:' || new.id);
    end if;
  end if;
  if new.payment_status in ('refunded', 'partially_refunded') and old.payment_status is distinct from new.payment_status then
    perform enqueue_event('refund_issued', 'booking', new.id, v_payload, 'refund_issued:' || new.id || ':' || new.payment_status);
  end if;
  return new;
end $$;

create trigger bookings_emit_events
  after update of status, payment_status on bookings
  for each row execute function bookings_emit_events();

create or replace function payouts_emit_events() returns trigger
language plpgsql as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    perform enqueue_event('payout_paid', 'payout', new.id,
      jsonb_build_object('provider_id', new.provider_id, 'amount_minor', new.amount_minor, 'currency', new.currency,
                         'booking_id', new.booking_id),
      'payout_paid:' || new.id);
  end if;
  return new;
end $$;

create trigger payouts_emit_events
  after update of status on payouts
  for each row execute function payouts_emit_events();

create or replace function messages_emit_events() returns trigger
language plpgsql as $$
declare t message_threads;
begin
  select * into t from message_threads where id = new.thread_id;
  update message_threads set last_message_at = new.created_at where id = t.id;
  if new.sender_side <> 'platform' then
    perform enqueue_event('new_message', 'message', new.id,
      jsonb_build_object('thread_id', t.id, 'booking_id', t.booking_id, 'to', case when new.sender_side = 'customer' then 'provider' else 'customer' end,
                         'customer_user_id', t.customer_user_id, 'provider_id', t.provider_id),
      'new_message:' || new.id);
  end if;
  return new;
end $$;

create trigger messages_emit_events
  after insert on messages
  for each row execute function messages_emit_events();

-- ---------------------------------------------------------------
-- Grants: everything is service-role only
-- ---------------------------------------------------------------
revoke all on function enqueue_event(text, text, uuid, jsonb, text, timestamptz, text) from public, anon, authenticated;
revoke all on function claim_pending_events(int) from public, anon, authenticated;
revoke all on function claim_due_notifications(int) from public, anon, authenticated;
revoke all on function provider_recipients(uuid) from public, anon, authenticated;
revoke all on function enqueue_due_reminders(timestamptz) from public, anon, authenticated;
grant execute on function enqueue_event(text, text, uuid, jsonb, text, timestamptz, text) to service_role;
grant execute on function claim_pending_events(int) to service_role;
grant execute on function claim_due_notifications(int) to service_role;
grant execute on function provider_recipients(uuid) to service_role;
grant execute on function enqueue_due_reminders(timestamptz) to service_role;
