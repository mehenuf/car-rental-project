-- Platform admin and operations (sub-project 8): staff roles, an append-only audit log, approvals
-- with four-eyes, settings history, per-currency reports and ledger integrity checks.
-- Expand-only. Existing admins (the `role: admin` claim) become super_admins below.

-- ---------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------
create table platform_staff (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        text not null check (role in ('super_admin', 'support', 'finance', 'reviewer')),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  disabled_at timestamptz
);
alter table platform_staff enable row level security;

create or replace function staff_role(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from platform_staff where user_id = p_user and disabled_at is null
$$;

-- ---------------------------------------------------------------
-- Audit log: append-only, written by the application and by triggers on sensitive tables
-- ---------------------------------------------------------------
create table audit_log (
  id             bigint generated always as identity primary key,
  at             timestamptz not null default now(),
  actor_user_id  uuid,
  actor_role     text,
  action         text not null,
  entity_type    text not null,
  entity_id      text,
  before         jsonb,
  after          jsonb,
  reason         text,
  ip             text,
  user_agent     text,
  request_id     text
);
create index audit_log_entity_idx on audit_log(entity_type, entity_id);
create index audit_log_actor_idx on audit_log(actor_user_id, at desc);
create index audit_log_at_idx on audit_log(at desc);
alter table audit_log enable row level security;

create or replace function audit_log_guard() returns trigger
language plpgsql as $$
begin
  raise exception 'the audit log is append-only' using errcode = 'BA010';
end $$;
create trigger audit_log_no_update before update on audit_log for each row execute function audit_log_guard();
create trigger audit_log_no_delete before delete on audit_log for each row execute function audit_log_guard();
create trigger audit_log_no_truncate before truncate on audit_log for each statement execute function audit_log_guard();

create or replace function audit_write(
  p_action text, p_entity_type text, p_entity_id text, p_before jsonb, p_after jsonb, p_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid();
begin
  insert into audit_log (actor_user_id, actor_role, action, entity_type, entity_id, before, after, reason)
  values (v_actor, case when v_actor is null then 'system' else staff_role(v_actor) end,
          p_action, p_entity_type, p_entity_id, p_before, p_after, p_reason);
end $$;

-- A direct database change to a sensitive table leaves a trace, whoever made it.
create or replace function audit_row_change() returns trigger
language plpgsql as $$
declare
  v_id text;
begin
  v_id := coalesce(to_jsonb(new) ->> tg_argv[0], to_jsonb(old) ->> tg_argv[0]);
  if tg_op = 'INSERT' then
    perform audit_write(tg_table_name || '.insert', tg_table_name, v_id, null, to_jsonb(new));
  elsif tg_op = 'DELETE' then
    perform audit_write(tg_table_name || '.delete', tg_table_name, v_id, to_jsonb(old), null);
  elsif to_jsonb(new) is distinct from to_jsonb(old) then
    perform audit_write(tg_table_name || '.update', tg_table_name, v_id, to_jsonb(old), to_jsonb(new));
  end if;
  return coalesce(new, old);
end $$;

create trigger providers_audit after update of status, commission_rate_override on providers
  for each row execute function audit_row_change('id');
create trigger payouts_audit after update of status, amount_minor on payouts
  for each row execute function audit_row_change('id');
create trigger platform_staff_audit after insert or update or delete on platform_staff
  for each row execute function audit_row_change('user_id');
create trigger user_flags_audit after insert or update or delete on user_flags
  for each row execute function audit_row_change('user_id');

-- ---------------------------------------------------------------
-- Settings with history and approval
-- ---------------------------------------------------------------
create table settings_history (
  id          bigint generated always as identity primary key,
  changed_at  timestamptz not null default now(),
  changed_by  uuid,
  before      jsonb not null,
  after       jsonb not null,
  approval_id uuid
);
alter table settings_history enable row level security;

create or replace function platform_settings_history() returns trigger
language plpgsql as $$
begin
  if to_jsonb(new) is distinct from to_jsonb(old) then
    insert into settings_history (changed_by, before, after) values (auth.uid(), to_jsonb(old), to_jsonb(new));
    perform audit_write('platform_settings.update', 'platform_settings', 'singleton', to_jsonb(old), to_jsonb(new));
  end if;
  return new;
end $$;
create trigger platform_settings_history after update on platform_settings
  for each row execute function platform_settings_history();

-- ---------------------------------------------------------------
-- Approvals: big money and settings changes need a second person
-- ---------------------------------------------------------------
create table approvals (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('refund', 'dispute_decision', 'payout_release', 'fee_change')),
  payload       jsonb not null default '{}'::jsonb,
  amount_minor  bigint check (amount_minor is null or amount_minor >= 0),
  currency      char(3),
  requested_by  uuid not null references auth.users(id),
  requested_at  timestamptz not null default now(),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'executed')),
  decided_by    uuid references auth.users(id),
  decided_at    timestamptz,
  note          text,
  -- Four-eyes, enforced by the database: nobody approves their own request.
  check (decided_by is null or decided_by <> requested_by)
);
create index approvals_pending_idx on approvals(requested_at) where status = 'pending';
alter table approvals enable row level security;
create trigger approvals_audit after insert or update on approvals
  for each row execute function audit_row_change('id');

-- Decides a request. Approving a fee change applies it in the same transaction.
create or replace function decide_approval(p_id uuid, p_decider uuid, p_approve boolean, p_note text default null)
returns approvals
language plpgsql as $$
declare
  a approvals;
begin
  select * into a from approvals where id = p_id for update;
  if not found then raise exception 'approval not found' using errcode = 'P0002'; end if;
  if a.status <> 'pending' then raise exception 'this request was already decided' using errcode = 'BA011'; end if;
  if coalesce(staff_role(p_decider), '') not in ('finance', 'super_admin') then
    raise exception 'only finance or a super admin can decide' using errcode = 'BA012';
  end if;

  update approvals
  set status = case when p_approve then 'approved' else 'rejected' end, decided_by = p_decider, decided_at = now(), note = p_note
  where id = a.id returning * into a;

  if p_approve and a.kind = 'fee_change' then
    update platform_settings
    set commission_bp = coalesce((a.payload ->> 'commission_bp')::int, commission_bp),
        service_fee_bp = coalesce((a.payload ->> 'service_fee_bp')::int, service_fee_bp);
    update settings_history set approval_id = a.id where id = (select max(id) from settings_history);
    update approvals set status = 'executed' where id = a.id returning * into a;
  end if;
  return a;
end $$;

create or replace function mark_approval_executed(p_id uuid) returns void
language sql as $$
  update approvals set status = 'executed' where id = p_id and status = 'approved'
$$;

-- ---------------------------------------------------------------
-- FX rates (reporting only) and catalogue requests
-- ---------------------------------------------------------------
create table fx_rates (
  date   date not null,
  base   char(3) not null,
  quote  char(3) not null,
  rate   numeric(18, 8) not null check (rate > 0),
  source text not null default 'manual',
  primary key (date, base, quote)
);
alter table fx_rates enable row level security;

create table model_requests (
  id          uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id) on delete cascade,
  brand       text not null check (length(btrim(brand)) between 1 and 100),
  name        text not null check (length(btrim(name)) between 1 and 100),
  notes       text,
  status      text not null default 'pending' check (status in ('pending', 'added', 'rejected')),
  created_at  timestamptz not null default now()
);
alter table model_requests enable row level security;
create policy "members read their model requests" on model_requests for select using (provider_id is not null and is_provider_member(provider_id));

-- ---------------------------------------------------------------
-- Reports: always per currency, never adding currencies together
-- ---------------------------------------------------------------
create view v_revenue_by_month_currency as
select date_trunc('month', t.created_at)::date as month, e.currency::text as currency,
       sum(case when e.direction = 'credit' then e.amount_minor else -e.amount_minor end)::bigint as revenue_minor
from ledger_entries e
join ledger_accounts a on a.id = e.account_id and a.code = 'platform_revenue'
join ledger_transactions t on t.id = e.transaction_id
group by 1, 2;

create view v_gmv_take_rate as
select g.month, g.currency, g.gmv_minor, coalesce(r.revenue_minor, 0) as revenue_minor,
       case when g.gmv_minor > 0 then round(coalesce(r.revenue_minor, 0) * 10000.0 / g.gmv_minor)::int else 0 end as take_rate_bp
from (
  select date_trunc('month', created_at)::date as month, currency::text as currency, sum(amount_minor)::bigint as gmv_minor
  from payments where kind = 'charge' and status = 'succeeded' group by 1, 2
) g
left join v_revenue_by_month_currency r on r.month = g.month and r.currency = g.currency;

create view v_refunds_by_month as
select date_trunc('month', created_at)::date as month, currency::text as currency,
       sum(amount_minor)::bigint as refunded_minor, count(*)::int as refunds
from payments where kind = 'refund' and status = 'succeeded' group by 1, 2;

create view v_payouts_by_provider as
select p.provider_id, p.currency::text as currency, p.status, sum(p.amount_minor)::bigint as amount_minor, count(*)::int as payouts
from payouts p group by 1, 2, 3;

create view v_tax_collected_by_country as
select br.country_code, b.currency::text as currency,
       sum((line ->> 'amountMinor')::bigint)::bigint as tax_minor
from bookings b
join branches br on br.id = b.pickup_branch_id
cross join lateral jsonb_array_elements(coalesce(b.price_snapshot -> 'quote' -> 'lines', '[]'::jsonb)) as line
where b.payment_status in ('paid', 'partially_refunded', 'refunded')
  and line ->> 'kind' = 'tax' and coalesce((line ->> 'included')::boolean, false) = false
group by 1, 2;

revoke all on v_revenue_by_month_currency, v_gmv_take_rate, v_refunds_by_month, v_payouts_by_provider, v_tax_collected_by_country
  from public, anon, authenticated;
grant select on v_revenue_by_month_currency, v_gmv_take_rate, v_refunds_by_month, v_payouts_by_provider, v_tax_collected_by_country to service_role;

-- ---------------------------------------------------------------
-- Ledger integrity
-- ---------------------------------------------------------------
create or replace function fn_trial_balance()
returns table (currency text, debit_minor bigint, credit_minor bigint, difference_minor bigint)
language sql stable as $$
  select e.currency::text,
         coalesce(sum(case when e.direction = 'debit' then e.amount_minor end), 0)::bigint,
         coalesce(sum(case when e.direction = 'credit' then e.amount_minor end), 0)::bigint,
         (coalesce(sum(case when e.direction = 'debit' then e.amount_minor end), 0)
          - coalesce(sum(case when e.direction = 'credit' then e.amount_minor end), 0))::bigint
  from ledger_entries e group by e.currency
$$;

-- Money received minus money refunded (plus captured deposits) must equal the ledger's cash account.
create or replace function fn_reconcile_payments()
returns table (currency text, payments_net_minor bigint, ledger_cash_minor bigint, difference_minor bigint)
language sql stable as $$
  with pay as (
    select p.currency::text as currency,
           sum(case when p.kind = 'charge' and p.status = 'succeeded' then p.amount_minor
                    when p.kind = 'refund' and p.status = 'succeeded' then -p.amount_minor
                    when p.kind = 'deposit_hold' and p.status = 'captured' then coalesce(p.captured_minor, 0)
                    else 0 end)::bigint as net
    from payments p group by p.currency
  ), led as (
    select e.currency::text as currency,
           sum(case when e.direction = 'debit' then e.amount_minor else -e.amount_minor end)::bigint as cash
    from ledger_entries e join ledger_accounts a on a.id = e.account_id and a.code = 'psp_cash'
    group by e.currency
  )
  select coalesce(pay.currency, led.currency), coalesce(pay.net, 0), coalesce(led.cash, 0), coalesce(pay.net, 0) - coalesce(led.cash, 0)
  from pay full join led on led.currency = pay.currency
$$;

-- Payouts marked paid must equal what the ledger says was paid out.
create or replace function fn_reconcile_payouts()
returns table (currency text, payouts_paid_minor bigint, ledger_paid_out_minor bigint, difference_minor bigint)
language sql stable as $$
  with po as (
    select p.currency::text as currency, sum(p.amount_minor)::bigint as paid from payouts p where p.status = 'paid' group by p.currency
  ), led as (
    select e.currency::text as currency, sum(e.amount_minor)::bigint as paid
    from ledger_entries e join ledger_accounts a on a.id = e.account_id and a.code = 'provider_paid_out' and e.direction = 'credit'
    group by e.currency
  )
  select coalesce(po.currency, led.currency), coalesce(po.paid, 0), coalesce(led.paid, 0), coalesce(po.paid, 0) - coalesce(led.paid, 0)
  from po full join led on led.currency = po.currency
$$;

-- ---------------------------------------------------------------
-- Existing admins become super admins; grants
-- ---------------------------------------------------------------
insert into platform_staff (user_id, role)
select id, 'super_admin' from auth.users where raw_app_meta_data ->> 'role' = 'admin'
on conflict (user_id) do nothing;

revoke all on function staff_role(uuid) from public, anon, authenticated;
revoke all on function audit_write(text, text, text, jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function decide_approval(uuid, uuid, boolean, text) from public, anon, authenticated;
revoke all on function mark_approval_executed(uuid) from public, anon, authenticated;
revoke all on function fn_trial_balance() from public, anon, authenticated;
revoke all on function fn_reconcile_payments() from public, anon, authenticated;
revoke all on function fn_reconcile_payouts() from public, anon, authenticated;
grant execute on function staff_role(uuid) to service_role;
grant execute on function audit_write(text, text, text, jsonb, jsonb, text) to service_role;
grant execute on function decide_approval(uuid, uuid, boolean, text) to service_role;
grant execute on function mark_approval_executed(uuid) to service_role;
grant execute on function fn_trial_balance() to service_role;
grant execute on function fn_reconcile_payments() to service_role;
grant execute on function fn_reconcile_payouts() to service_role;

-- A flat view of ledger entries for the CSV export (the ledger tables themselves are normalised).
create view ledger_entries_export as
select e.id as entry_id, t.id as transaction_id, t.created_at, t.kind, a.code as account, e.direction,
       e.amount_minor, e.currency::text as currency, t.booking_id
from ledger_entries e
join ledger_transactions t on t.id = e.transaction_id
join ledger_accounts a on a.id = e.account_id;
revoke all on ledger_entries_export from public, anon, authenticated;
grant select on ledger_entries_export to service_role;
