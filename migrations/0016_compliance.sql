-- Compliance, security and localisation storage (sub-project 9, part B): consent and policy
-- versions, data-subject requests (export and erasure), retention, translated catalogue text, and a
-- durable rate limiter. Expand-only.

-- ---------------------------------------------------------------
-- Consent and policies
-- ---------------------------------------------------------------
create table policy_versions (
  kind         text not null check (kind in ('terms', 'privacy', 'cookies')),
  version      text not null,
  published_at timestamptz not null default now(),
  content_hash text,
  primary key (kind, version)
);
insert into policy_versions (kind, version) values ('terms', '2026-09'), ('privacy', '2026-09'), ('cookies', '2026-09');
alter table policy_versions enable row level security;
create policy "anyone reads policy versions" on policy_versions for select using (true);

create table consents (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete set null,
  anon_id        text,
  purpose        text not null check (purpose in ('necessary', 'analytics')),
  granted        boolean not null,
  policy_version text not null,
  ip_hash        text,
  created_at     timestamptz not null default now(),
  check (user_id is not null or anon_id is not null)
);
create index consents_user_idx on consents(user_id, created_at desc);
create index consents_anon_idx on consents(anon_id, created_at desc);
alter table consents enable row level security;

create table policy_acceptances (
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null,
  version     text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, kind, version),
  foreign key (kind, version) references policy_versions(kind, version)
);
alter table policy_acceptances enable row level security;

-- ---------------------------------------------------------------
-- Data-subject requests and retention
-- ---------------------------------------------------------------
create table data_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  kind         text not null check (kind in ('export', 'erase')),
  status       text not null default 'requested' check (status in ('requested', 'verifying', 'processing', 'done', 'rejected')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  note         text
);
create index data_requests_user_idx on data_requests(user_id, requested_at desc);
alter table data_requests enable row level security;
create policy "users read their own requests" on data_requests for select using (user_id = auth.uid());

create table retention_rules (
  entity    text primary key check (entity in ('notifications', 'outbox_events', 'rate_limits', 'consents_anonymous')),
  keep_days int not null check (keep_days > 0),
  action    text not null default 'delete' check (action in ('delete'))
);
insert into retention_rules (entity, keep_days) values
  ('notifications', 365), ('outbox_events', 90), ('rate_limits', 2), ('consents_anonymous', 1825);
alter table retention_rules enable row level security;

-- Applies the retention rules. Financial records (bookings, payments, the ledger, receipts) are never touched.
create or replace function apply_retention(p_now timestamptz default now()) returns jsonb
language plpgsql as $$
declare
  v_notifications int; v_events int; v_limits int; v_consents int;
begin
  with d as (delete from notifications where created_at < p_now - make_interval(days => (select keep_days from retention_rules where entity = 'notifications')) and status <> 'queued' returning 1)
  select count(*) into v_notifications from d;
  with d as (delete from outbox_events where status <> 'pending' and created_at < p_now - make_interval(days => (select keep_days from retention_rules where entity = 'outbox_events')) returning 1)
  select count(*) into v_events from d;
  with d as (delete from rate_limits where window_start < p_now - make_interval(days => (select keep_days from retention_rules where entity = 'rate_limits')) returning 1)
  select count(*) into v_limits from d;
  with d as (delete from consents where user_id is null and created_at < p_now - make_interval(days => (select keep_days from retention_rules where entity = 'consents_anonymous')) returning 1)
  select count(*) into v_consents from d;
  return jsonb_build_object('notifications', v_notifications, 'outbox_events', v_events, 'rate_limits', v_limits, 'consents', v_consents);
end $$;

-- ---------------------------------------------------------------
-- Everything a person has given us, as one JSON document
-- ---------------------------------------------------------------
create or replace function export_user_data(p_user uuid) returns jsonb
language sql stable security definer set search_path = public, auth as $$
  select jsonb_build_object(
    'exportedAt', now(),
    'account', (select jsonb_build_object('id', id, 'email', email, 'createdAt', created_at) from auth.users where id = p_user),
    'bookings', coalesce((select jsonb_agg(jsonb_build_object(
        'reference', reference, 'status', status, 'paymentStatus', payment_status, 'currency', currency,
        'totalAmount', total_amount, 'pickupAt', pickup_at, 'dropoffAt', dropoff_at, 'customerName', customer_name,
        'email', email, 'phone', phone) order by created_at) from bookings where user_id = p_user), '[]'::jsonb),
    'driverProfile', (select to_jsonb(d) - 'reviewed_by' from driver_profiles d where user_id = p_user),
    'receipts', coalesce((select jsonb_agg(jsonb_build_object('number', r.number, 'issuedAt', r.issued_at))
        from receipts r join bookings b on b.id = r.booking_id where b.user_id = p_user), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('overall', overall, 'comment', comment, 'submittedAt', submitted_at))
        from reviews where author_user_id = p_user), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('body', body, 'createdAt', created_at) order by created_at)
        from messages where sender_user_id = p_user), '[]'::jsonb),
    'notificationPreferences', coalesce((select jsonb_agg(jsonb_build_object('category', category, 'channel', channel, 'enabled', enabled))
        from notification_preferences where user_id = p_user), '[]'::jsonb),
    'contact', (select jsonb_build_object('phone', phone_e164, 'smsOptIn', sms_opt_in, 'locale', locale, 'timezone', timezone)
        from contact_channels where user_id = p_user),
    'consents', coalesce((select jsonb_agg(jsonb_build_object('purpose', purpose, 'granted', granted, 'policyVersion', policy_version, 'at', created_at) order by created_at)
        from consents where user_id = p_user), '[]'::jsonb),
    'policiesAccepted', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'version', version, 'at', accepted_at))
        from policy_acceptances where user_id = p_user), '[]'::jsonb)
  )
$$;

-- ---------------------------------------------------------------
-- Erasure: personal data is removed or tombstoned; financial history stays, without personal data
-- ---------------------------------------------------------------
create or replace function erase_user(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_bookings int;
begin
  if exists (select 1 from bookings where user_id = p_user and status in ('pending', 'confirmed', 'active')) then
    raise exception 'finish or cancel your open bookings first' using errcode = 'BE001';
  end if;
  if exists (select 1 from disputes d join bookings b on b.id = d.booking_id
             where b.user_id = p_user and d.status not in ('resolved', 'dismissed')) then
    raise exception 'an open dispute must be settled first' using errcode = 'BE001';
  end if;

  -- Receipts carry the renter's name and email inside their snapshot.
  update receipts set snapshot = snapshot - 'customerName' - 'email'
  where booking_id in (select id from bookings where user_id = p_user);

  with b as (
    update bookings
    set customer_name = 'Deleted user', email = 'deleted-' || id || '@deleted.invalid', phone = null, user_id = null, guest_id = null
    where user_id = p_user returning 1
  ) select count(*) into v_bookings from b;

  update messages set body = '[deleted]', sender_user_id = null where sender_user_id = p_user;
  update reviews set comment = null, author_user_id = null where author_user_id = p_user and direction = 'customer_to_provider';
  update reviews set comment = null, subject_user_id = null where subject_user_id = p_user;
  update consents set anon_id = 'erased', user_id = null where user_id = p_user;

  delete from driver_documents where user_id = p_user;
  delete from driver_profiles where user_id = p_user;
  delete from notifications where recipient_user_id = p_user;
  delete from notification_preferences where user_id = p_user;
  delete from contact_channels where user_id = p_user;
  delete from push_subscriptions where user_id = p_user;
  delete from guest_claims where user_id = p_user;
  delete from policy_acceptances where user_id = p_user;
  delete from user_flags where user_id = p_user;

  update data_requests set status = 'done', completed_at = now() where user_id = p_user and kind = 'erase' and status <> 'done';
  return jsonb_build_object('bookingsAnonymised', v_bookings);
end $$;

-- ---------------------------------------------------------------
-- Translated catalogue text (English is the fallback)
-- ---------------------------------------------------------------
create table vehicle_translations (
  vehicle_id  uuid not null references vehicles(id) on delete cascade,
  lang        text not null check (lang in ('bn', 'es', 'fr', 'ar', 'pt', 'zh', 'ja', 'nl', 'de', 'id')),
  description text,
  features    jsonb,
  primary key (vehicle_id, lang)
);
alter table vehicle_translations enable row level security;
create policy "anyone reads vehicle translations" on vehicle_translations for select using (true);

-- ---------------------------------------------------------------
-- Durable rate limiter: one atomic upsert per hit, shared by every serverless instance
-- ---------------------------------------------------------------
create table rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         int not null default 0,
  primary key (key, window_start)
);
alter table rate_limits enable row level security;

create or replace function rate_limit_hit(p_key text, p_window_seconds int, p_limit int)
returns table (allowed boolean, remaining int, retry_after_seconds int)
language plpgsql as $$
declare
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits int;
begin
  insert into rate_limits (key, window_start, hits) values (p_key, v_start, 1)
  on conflict (key, window_start) do update set hits = rate_limits.hits + 1
  returning hits into v_hits;
  return query select v_hits <= p_limit, greatest(0, p_limit - v_hits),
    case when v_hits <= p_limit then 0 else greatest(1, ceil(extract(epoch from (v_start + make_interval(secs => p_window_seconds) - now())))::int) end;
end $$;

-- ---------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------
revoke all on function apply_retention(timestamptz) from public, anon, authenticated;
revoke all on function export_user_data(uuid) from public, anon, authenticated;
revoke all on function erase_user(uuid) from public, anon, authenticated;
revoke all on function rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function apply_retention(timestamptz) to service_role;
grant execute on function export_user_data(uuid) to service_role;
grant execute on function erase_user(uuid) to service_role;
grant execute on function rate_limit_hit(text, int, int) to service_role;
