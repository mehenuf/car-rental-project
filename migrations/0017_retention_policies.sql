-- Retention for licence documents and messages, and the "policies changed, please accept" check.
-- Expand-only: adds rules and functions; nothing is dropped.

alter table retention_rules drop constraint retention_rules_entity_check;
alter table retention_rules add constraint retention_rules_entity_check
  check (entity in ('notifications', 'outbox_events', 'rate_limits', 'consents_anonymous', 'driver_documents', 'messages'));
-- Starting values, to be confirmed with counsel: licence photos two years after upload, messages three years.
insert into retention_rules (entity, keep_days) values ('driver_documents', 730), ('messages', 1095)
on conflict (entity) do nothing;

-- Licence photos past their keep period whose owner has no open booking. The caller removes the files from
-- storage and then calls apply_retention, which deletes the rows; both steps can be repeated safely.
create or replace function expired_driver_documents(p_now timestamptz default now()) returns table (storage_path text)
language sql stable as $$
  select d.storage_path from driver_documents d
  where d.created_at < p_now - make_interval(days => (select keep_days from retention_rules where entity = 'driver_documents'))
    and not exists (select 1 from bookings b where b.user_id = d.user_id and b.status in ('pending', 'confirmed', 'active'))
$$;

create or replace function apply_retention(p_now timestamptz default now()) returns jsonb
language plpgsql as $$
declare
  v_notifications int; v_events int; v_limits int; v_consents int; v_documents int; v_messages int;
begin
  with d as (delete from notifications where created_at < p_now - make_interval(days => (select keep_days from retention_rules where entity = 'notifications')) and status <> 'queued' returning 1)
  select count(*) into v_notifications from d;
  with d as (delete from outbox_events where status <> 'pending' and created_at < p_now - make_interval(days => (select keep_days from retention_rules where entity = 'outbox_events')) returning 1)
  select count(*) into v_events from d;
  with d as (delete from rate_limits where window_start < p_now - make_interval(days => (select keep_days from retention_rules where entity = 'rate_limits')) returning 1)
  select count(*) into v_limits from d;
  with d as (delete from consents where user_id is null and created_at < p_now - make_interval(days => (select keep_days from retention_rules where entity = 'consents_anonymous')) returning 1)
  select count(*) into v_consents from d;
  with d as (delete from driver_documents where storage_path in (select storage_path from expired_driver_documents(p_now)) returning 1)
  select count(*) into v_documents from d;
  -- Messages go once the booking is over and no dispute is open on it.
  with d as (
    delete from messages m using message_threads t, bookings b
    where m.thread_id = t.id and b.id = t.booking_id
      and b.status in ('completed', 'cancelled')
      and m.created_at < p_now - make_interval(days => (select keep_days from retention_rules where entity = 'messages'))
      and not exists (select 1 from disputes x where x.booking_id = b.id and x.status not in ('resolved', 'dismissed'))
    returning 1)
  select count(*) into v_messages from d;
  return jsonb_build_object('notifications', v_notifications, 'outbox_events', v_events, 'rate_limits', v_limits,
    'consents', v_consents, 'driver_documents', v_documents, 'messages', v_messages);
end $$;

-- ---------------------------------------------------------------
-- Policies a person still has to accept: the newest terms and privacy version they have not accepted yet.
-- ---------------------------------------------------------------
create or replace function pending_policies(p_user uuid) returns table (kind text, version text)
language sql stable security definer set search_path = public as $$
  select distinct on (v.kind) v.kind, v.version
  from policy_versions v
  where v.kind in ('terms', 'privacy')
  order by v.kind, v.published_at desc, v.version desc
$$;

-- The subset for one person (newest version per kind that they have not accepted).
create or replace function policies_to_accept(p_user uuid) returns table (kind text, version text)
language sql stable security definer set search_path = public as $$
  select p.kind, p.version from pending_policies(p_user) p
  where not exists (select 1 from policy_acceptances a where a.user_id = p_user and a.kind = p.kind and a.version = p.version)
$$;

create or replace function accept_policies(p_user uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  with i as (
    insert into policy_acceptances (user_id, kind, version)
    select p_user, p.kind, p.version from policies_to_accept(p_user) p
    on conflict do nothing returning 1)
  select count(*) into v_count from i;
  return v_count;
end $$;

revoke all on function expired_driver_documents(timestamptz) from public, anon, authenticated;
revoke all on function apply_retention(timestamptz) from public, anon, authenticated;
revoke all on function pending_policies(uuid) from public, anon, authenticated;
revoke all on function policies_to_accept(uuid) from public, anon, authenticated;
revoke all on function accept_policies(uuid) from public, anon, authenticated;
grant execute on function expired_driver_documents(timestamptz) to service_role;
grant execute on function apply_retention(timestamptz) to service_role;
grant execute on function pending_policies(uuid) to service_role;
grant execute on function policies_to_accept(uuid) to service_role;
grant execute on function accept_policies(uuid) to service_role;
