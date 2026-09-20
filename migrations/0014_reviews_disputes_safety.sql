-- Reviews, disputes and trust and safety (sub-project 7), plus three small follow-ups to earlier
-- sub-projects: licences expire, return reminders, and licence decision notices.
-- Money moves only through the ledger-backed functions from 0009 (capture_deposit and the refund
-- functions); disputes freeze the provider's payout and hold back the deposit release meanwhile.

-- ---------------------------------------------------------------
-- Follow-ups: licence expiry, licence decision events, return reminders
-- ---------------------------------------------------------------
create or replace function expire_licences(p_today date default current_date) returns int
language plpgsql as $$
declare v_count int;
begin
  with expired as (
    update driver_profiles
    set status = 'expired', updated_at = now()
    where status = 'verified' and licence_expiry < p_today
    returning user_id
  )
  select count(*) into v_count from expired;
  return v_count;
end $$;

create or replace function driver_profiles_emit_events() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare
  v_email text;
  v_name text;
begin
  if new.status in ('verified', 'rejected', 'expired') and old.status is distinct from new.status then
    select email, raw_user_meta_data ->> 'full_name' into v_email, v_name from auth.users where id = new.user_id;
    if v_email is not null then
      perform enqueue_event('licence_' || new.status, 'driver_profile', new.user_id,
        jsonb_build_object('user_id', new.user_id, 'email', v_email, 'name', v_name, 'note', coalesce(new.review_note, '')),
        'licence_' || new.status || ':' || new.user_id || ':' || extract(epoch from now())::bigint);
    end if;
  end if;
  return new;
end $$;

create trigger driver_profiles_emit_events
  after update of status on driver_profiles
  for each row execute function driver_profiles_emit_events();

create or replace function enqueue_due_reminders(p_now timestamptz default now()) returns int
language plpgsql as $$
declare
  b record;
  v_count int := 0;
begin
  for b in
    select id, reference, user_id, email, customer_name, pickup_at, dropoff_at
    from bookings
    where status = 'confirmed' and payment_status in ('paid', 'partially_refunded')
      and pickup_at > p_now and pickup_at <= p_now + interval '24 hours'
  loop
    if enqueue_event('pickup_reminder', 'booking', b.id,
        jsonb_build_object('reference', b.reference, 'user_id', b.user_id, 'email', b.email,
                           'name', b.customer_name, 'pickup_at', b.pickup_at, 'dropoff_at', b.dropoff_at),
        'pickup_reminder:' || b.id) is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  for b in
    select id, reference, user_id, email, customer_name, pickup_at, dropoff_at
    from bookings
    where status = 'active' and dropoff_at > p_now and dropoff_at <= p_now + interval '24 hours'
  loop
    if enqueue_event('return_reminder', 'booking', b.id,
        jsonb_build_object('reference', b.reference, 'user_id', b.user_id, 'email', b.email,
                           'name', b.customer_name, 'pickup_at', b.pickup_at, 'dropoff_at', b.dropoff_at),
        'return_reminder:' || b.id) is not null then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;

-- ---------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------
create table reviews (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null references bookings(id) on delete cascade,
  direction           text not null check (direction in ('customer_to_provider', 'provider_to_customer')),
  author_user_id      uuid references auth.users(id) on delete set null,
  subject_provider_id uuid references providers(id) on delete cascade,
  subject_user_id     uuid references auth.users(id) on delete set null,
  vehicle_id          uuid references vehicles(id) on delete set null,
  overall             int not null check (overall between 1 and 5),
  aspects             jsonb not null default '{}'::jsonb,
  comment             text check (comment is null or length(comment) <= 2000),
  status              text not null default 'hidden' check (status in ('hidden', 'published', 'removed')),
  submitted_at        timestamptz not null default now(),
  published_at        timestamptz,
  edited_at           timestamptz,
  removed_reason      text,
  unique (booking_id, direction)
);
create index reviews_provider_idx on reviews(subject_provider_id) where status = 'published';
create index reviews_vehicle_idx on reviews(vehicle_id) where status = 'published';

create table review_replies (
  review_id   uuid primary key references reviews(id) on delete cascade,
  provider_id uuid not null references providers(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  body        text not null check (length(btrim(body)) between 1 and 1000),
  created_at  timestamptz not null default now()
);

create table review_reports (
  id               uuid primary key default gen_random_uuid(),
  review_id        uuid not null references reviews(id) on delete cascade,
  reporter_user_id uuid references auth.users(id) on delete set null,
  reason           text not null check (length(btrim(reason)) between 1 and 500),
  status           text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at       timestamptz not null default now(),
  unique (review_id, reporter_user_id)
);

alter table reviews        enable row level security;
alter table review_replies enable row level security;
alter table review_reports enable row level security;

-- Published reviews and their replies are public; authors also see their own.
create policy "anyone reads published reviews" on reviews for select using (status = 'published');
create policy "authors read their reviews" on reviews for select using (author_user_id = auth.uid());
create policy "anyone reads replies to published reviews" on review_replies for select
  using (exists (select 1 from reviews r where r.id = review_id and r.status = 'published'));

-- Bayesian average, so a single review cannot swing a new listing: (3 * 4.0 + sum) / (3 + n).
create or replace function bayes_rating(p_sum numeric, p_count int) returns numeric
language sql immutable as $$
  select round((3 * 4.0 + coalesce(p_sum, 0)) / (3 + coalesce(p_count, 0)), 2)
$$;

create table provider_ratings (
  provider_id  uuid primary key references providers(id) on delete cascade,
  review_count int not null default 0,
  rating_sum   int not null default 0,
  bayes_score  numeric(3, 2) not null default 4.00,
  updated_at   timestamptz not null default now()
);
alter table provider_ratings enable row level security;
create policy "anyone reads provider ratings" on provider_ratings for select using (true);

-- The catalogue rating and review count become derived from published reviews.
create or replace function refresh_ratings(p_provider_id uuid, p_vehicle_id uuid) returns void
language plpgsql as $$
declare v_sum int; v_count int;
begin
  if p_provider_id is not null then
    select coalesce(sum(overall), 0), count(*) into v_sum, v_count
    from reviews where subject_provider_id = p_provider_id and direction = 'customer_to_provider' and status = 'published';
    insert into provider_ratings (provider_id, review_count, rating_sum, bayes_score, updated_at)
    values (p_provider_id, v_count, v_sum, bayes_rating(v_sum, v_count), now())
    on conflict (provider_id) do update
      set review_count = excluded.review_count, rating_sum = excluded.rating_sum,
          bayes_score = excluded.bayes_score, updated_at = now();
  end if;
  if p_vehicle_id is not null then
    select coalesce(sum(overall), 0), count(*) into v_sum, v_count
    from reviews where vehicle_id = p_vehicle_id and direction = 'customer_to_provider' and status = 'published';
    update vehicles set rating = bayes_rating(v_sum, v_count), review_count = v_count where id = p_vehicle_id;
  end if;
end $$;

create or replace function reviews_refresh_trigger() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'INSERT' and new.status = 'published')
     or (tg_op = 'UPDATE' and (new.status = 'published' or old.status = 'published') and old.status is distinct from new.status) then
    perform refresh_ratings(new.subject_provider_id, new.vehicle_id);
  end if;
  return new;
end $$;

create trigger reviews_refresh after insert or update of status on reviews
  for each row execute function reviews_refresh_trigger();

-- One review per side, on a completed booking, within 14 days of the return. A review stays hidden
-- until the other side has reviewed too (or the window ends); then both appear together.
create or replace function submit_review(
  p_booking_id uuid,
  p_direction text,
  p_author uuid,
  p_overall int,
  p_aspects jsonb,
  p_comment text
) returns reviews
language plpgsql as $$
declare
  b bookings;
  r reviews;
  v_other reviews;
begin
  select * into b from bookings where id = p_booking_id for update;
  if not found then raise exception 'booking not found' using errcode = 'P0002'; end if;
  if b.status <> 'completed' then raise exception 'only a completed rental can be reviewed' using errcode = 'BR001'; end if;
  if b.completed_at is null or now() > b.completed_at + interval '14 days' then
    raise exception 'the review window has closed' using errcode = 'BR002';
  end if;

  if p_direction = 'customer_to_provider' then
    if b.user_id is distinct from p_author then raise exception 'not your booking' using errcode = 'BR003'; end if;
  elsif p_direction = 'provider_to_customer' then
    if b.provider_id is null or not exists (select 1 from provider_members m where m.provider_id = b.provider_id and m.user_id = p_author) then
      raise exception 'not your booking' using errcode = 'BR003';
    end if;
    if b.user_id is null then raise exception 'the renter has no account to review' using errcode = 'BR004'; end if;
  else
    raise exception 'unknown direction' using errcode = 'BR003';
  end if;

  insert into reviews (booking_id, direction, author_user_id, subject_provider_id, subject_user_id, vehicle_id, overall, aspects, comment)
  values (
    b.id, p_direction, p_author,
    case when p_direction = 'customer_to_provider' then b.provider_id end,
    case when p_direction = 'provider_to_customer' then b.user_id end,
    case when p_direction = 'customer_to_provider' then b.vehicle_id end,
    p_overall, coalesce(p_aspects, '{}'::jsonb), nullif(btrim(coalesce(p_comment, '')), ''))
  returning * into r;

  select * into v_other from reviews
  where booking_id = b.id and direction <> p_direction and status = 'hidden';
  if found then
    update reviews set status = 'published', published_at = now() where id in (r.id, v_other.id);
    select * into r from reviews where id = r.id;
  end if;
  return r;
end $$;

-- Editing is allowed for 48 hours, and only while the review is still hidden.
create or replace function edit_review(
  p_review_id uuid, p_author uuid, p_overall int, p_aspects jsonb, p_comment text
) returns reviews
language plpgsql as $$
declare r reviews;
begin
  select * into r from reviews where id = p_review_id for update;
  if not found then raise exception 'review not found' using errcode = 'P0002'; end if;
  if r.author_user_id is distinct from p_author then raise exception 'not your review' using errcode = 'BR003'; end if;
  if r.status <> 'hidden' or now() > r.submitted_at + interval '48 hours' then
    raise exception 'this review can no longer be edited' using errcode = 'BR005';
  end if;
  update reviews
  set overall = p_overall, aspects = coalesce(p_aspects, aspects),
      comment = nullif(btrim(coalesce(p_comment, '')), ''), edited_at = now()
  where id = r.id returning * into r;
  return r;
end $$;

-- Reveals reviews whose 14-day window has ended without the other side reviewing.
create or replace function publish_due_reviews(p_now timestamptz default now()) returns int
language plpgsql as $$
declare v_count int;
begin
  with due as (
    update reviews r set status = 'published', published_at = p_now
    from bookings b
    where r.booking_id = b.id and r.status = 'hidden' and b.completed_at + interval '14 days' <= p_now
    returning r.id
  )
  select count(*) into v_count from due;
  return v_count;
end $$;

-- A provider may reply once to a published review of them.
create or replace function reply_to_review(p_review_id uuid, p_author uuid, p_body text) returns review_replies
language plpgsql as $$
declare
  r reviews;
  reply review_replies;
begin
  select * into r from reviews where id = p_review_id;
  if not found then raise exception 'review not found' using errcode = 'P0002'; end if;
  if r.direction <> 'customer_to_provider' or r.status <> 'published' then
    raise exception 'this review cannot be replied to' using errcode = 'BR006';
  end if;
  if not exists (select 1 from provider_members m where m.provider_id = r.subject_provider_id and m.user_id = p_author) then
    raise exception 'not your review to answer' using errcode = 'BR003';
  end if;
  insert into review_replies (review_id, provider_id, author_user_id, body)
  values (r.id, r.subject_provider_id, p_author, btrim(p_body)) returning * into reply;
  return reply;
end $$;

create or replace function remove_review(p_review_id uuid, p_reason text) returns reviews
language plpgsql as $$
declare r reviews;
begin
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'a reason is required' using errcode = 'BR007';
  end if;
  update reviews set status = 'removed', removed_reason = btrim(p_reason) where id = p_review_id returning * into r;
  if not found then raise exception 'review not found' using errcode = 'P0002'; end if;
  return r;
end $$;

-- Ask the renter for a review when the rental completes.
create or replace function bookings_review_request() returns trigger
language plpgsql as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' and new.user_id is not null then
    perform enqueue_event('review_request', 'booking', new.id,
      jsonb_build_object('reference', new.reference, 'user_id', new.user_id, 'email', new.email, 'name', new.customer_name,
                         'pickup_at', new.pickup_at, 'dropoff_at', new.dropoff_at),
      'review_request:' || new.id);
  end if;
  return new;
end $$;
create trigger bookings_review_request after update of status on bookings
  for each row execute function bookings_review_request();

-- ---------------------------------------------------------------
-- Disputes
-- ---------------------------------------------------------------
create table disputes (
  id                   uuid primary key default gen_random_uuid(),
  booking_id           uuid not null references bookings(id) on delete cascade,
  opened_by_side       text not null check (opened_by_side in ('customer', 'provider')),
  opened_by            uuid references auth.users(id) on delete set null,
  type                 text not null check (type in ('damage', 'cleanliness_or_fees', 'listing_mismatch', 'overcharge', 'service_problem')),
  status               text not null default 'awaiting_response'
    check (status in ('awaiting_response', 'negotiating', 'agreed', 'escalated', 'resolved', 'dismissed')),
  currency             char(3) not null,
  claimed_amount_minor bigint check (claimed_amount_minor is null or claimed_amount_minor > 0),
  offer_minor          bigint check (offer_minor is null or offer_minor >= 0),
  offer_by_side        text check (offer_by_side in ('customer', 'provider')),
  offer_count          int not null default 0,
  agreed_amount_minor  bigint check (agreed_amount_minor is null or agreed_amount_minor >= 0),
  resolution           text check (resolution in ('capture', 'refund', 'dismiss')),
  deadline_at          timestamptz not null,
  resolved_at          timestamptz,
  resolved_by          uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now()
);
-- Only one unresolved dispute per booking.
create unique index disputes_one_open_per_booking on disputes(booking_id) where status not in ('resolved', 'dismissed');
create index disputes_due_idx on disputes(deadline_at) where status in ('awaiting_response', 'negotiating');

create table dispute_events (
  id             bigint generated always as identity primary key,
  dispute_id     uuid not null references disputes(id) on delete cascade,
  actor_side     text not null check (actor_side in ('customer', 'provider', 'platform')),
  actor_user_id  uuid references auth.users(id) on delete set null,
  kind           text not null check (kind in ('open', 'message', 'evidence', 'offer', 'accept', 'contest', 'escalate', 'decision')),
  body           text check (body is null or length(body) <= 2000),
  amount_minor   bigint check (amount_minor is null or amount_minor >= 0),
  photo_paths    text[] not null default '{}' check (cardinality(photo_paths) <= 10),
  created_at     timestamptz not null default now()
);
create index dispute_events_dispute_idx on dispute_events(dispute_id, id);

alter table disputes       enable row level security;
alter table dispute_events enable row level security;

-- Bookings have their own row-level security, so party checks go through a security-definer helper.
create or replace function is_booking_party(p_booking_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from bookings b
    where b.id = p_booking_id and (b.user_id = auth.uid() or is_provider_member(b.provider_id))
  );
$$;

create policy "parties read their disputes" on disputes for select using (is_booking_party(booking_id));
create policy "parties read dispute events" on dispute_events for select using (
  exists (select 1 from disputes d where d.id = dispute_id and is_booking_party(d.booking_id)));

create or replace function booking_has_open_dispute(p_booking_id uuid) returns boolean
language sql stable as $$
  select exists (select 1 from disputes where booking_id = p_booking_id and status not in ('resolved', 'dismissed'))
$$;

-- Opens within 48 hours of the return, freezes the payout, and records the claim.
create or replace function open_dispute(
  p_booking_id uuid, p_side text, p_user uuid, p_type text, p_claimed_minor bigint, p_body text, p_photo_paths text[] default '{}'
) returns disputes
language plpgsql as $$
declare
  b bookings;
  d disputes;
  v_deposit bigint;
begin
  select * into b from bookings where id = p_booking_id for update;
  if not found then raise exception 'booking not found' using errcode = 'P0002'; end if;
  if b.status <> 'completed' or b.completed_at is null or now() > b.completed_at + interval '48 hours' then
    raise exception 'disputes open within 48 hours of the return' using errcode = 'BD001';
  end if;

  if p_side = 'customer' then
    if b.user_id is distinct from p_user then raise exception 'not your booking' using errcode = 'BD002'; end if;
    if p_type not in ('listing_mismatch', 'overcharge', 'service_problem') then
      raise exception 'a renter cannot open a % dispute', p_type using errcode = 'BD003';
    end if;
  elsif p_side = 'provider' then
    if b.provider_id is null or not exists (select 1 from provider_members m where m.provider_id = b.provider_id and m.user_id = p_user) then
      raise exception 'not your booking' using errcode = 'BD002';
    end if;
    if p_type not in ('damage', 'cleanliness_or_fees') then
      raise exception 'a provider cannot open a % dispute', p_type using errcode = 'BD003';
    end if;
  else
    raise exception 'unknown side' using errcode = 'BD003';
  end if;

  select coalesce(sum(amount_minor), 0) into v_deposit
  from payments where booking_id = b.id and kind = 'deposit_hold' and status = 'succeeded';

  if p_side = 'provider' then
    if p_claimed_minor is null or p_claimed_minor <= 0 then raise exception 'state the amount claimed' using errcode = 'BD004'; end if;
    if p_claimed_minor > v_deposit then raise exception 'a claim cannot exceed the deposit held' using errcode = 'BD004'; end if;
  elsif p_claimed_minor is not null and p_claimed_minor > coalesce((b.price_snapshot -> 'quote' ->> 'totalMinor')::bigint, 0) then
    raise exception 'a claim cannot exceed the amount paid' using errcode = 'BD004';
  end if;

  insert into disputes (booking_id, opened_by_side, opened_by, type, currency, claimed_amount_minor, offer_minor, offer_by_side, deadline_at)
  values (b.id, p_side, p_user, p_type, coalesce(b.currency, 'USD'), p_claimed_minor, p_claimed_minor,
          case when p_claimed_minor is not null then p_side end, now() + interval '72 hours')
  returning * into d;

  insert into dispute_events (dispute_id, actor_side, actor_user_id, kind, body, amount_minor, photo_paths)
  values (d.id, p_side, p_user, 'open', p_body, p_claimed_minor, coalesce(p_photo_paths, '{}'));

  update payouts set status = 'frozen' where booking_id = b.id and status = 'pending';
  return d;
end $$;

-- A reply from either side. Only the other party may accept, counter or contest an offer.
create or replace function respond_dispute(
  p_dispute_id uuid, p_side text, p_user uuid, p_action text, p_body text default null,
  p_amount bigint default null, p_photo_paths text[] default '{}'
) returns disputes
language plpgsql as $$
declare
  d disputes;
  b bookings;
begin
  select * into d from disputes where id = p_dispute_id for update;
  if not found then raise exception 'dispute not found' using errcode = 'P0002'; end if;
  select * into b from bookings where id = d.booking_id;

  if p_side = 'customer' and b.user_id is distinct from p_user then raise exception 'not a party' using errcode = 'BD002'; end if;
  if p_side = 'provider' and (b.provider_id is null or not exists (select 1 from provider_members m where m.provider_id = b.provider_id and m.user_id = p_user)) then
    raise exception 'not a party' using errcode = 'BD002';
  end if;
  if p_side not in ('customer', 'provider') then raise exception 'unknown side' using errcode = 'BD003'; end if;
  if d.status in ('resolved', 'dismissed', 'agreed') then raise exception 'this dispute is closed' using errcode = 'BD005'; end if;

  if p_action in ('message', 'evidence') then
    insert into dispute_events (dispute_id, actor_side, actor_user_id, kind, body, photo_paths)
    values (d.id, p_side, p_user, p_action, p_body, coalesce(p_photo_paths, '{}'));
    return d;
  end if;

  if d.offer_by_side is not distinct from p_side then
    raise exception 'wait for the other side to respond' using errcode = 'BD006';
  end if;

  if p_action = 'accept' then
    if d.offer_minor is null then raise exception 'there is no offer to accept' using errcode = 'BD006'; end if;
    update disputes set status = 'agreed', agreed_amount_minor = d.offer_minor where id = d.id returning * into d;
    insert into dispute_events (dispute_id, actor_side, actor_user_id, kind, amount_minor) values (d.id, p_side, p_user, 'accept', d.offer_minor);
  elsif p_action = 'counter' then
    if p_amount is null or p_amount < 0 or (d.claimed_amount_minor is not null and p_amount > d.claimed_amount_minor) then
      raise exception 'the counter offer is out of range' using errcode = 'BD004';
    end if;
    if d.offer_count >= 5 then raise exception 'too many offers; ask a reviewer to decide' using errcode = 'BD006'; end if;
    update disputes
    set status = 'negotiating', offer_minor = p_amount, offer_by_side = p_side, offer_count = offer_count + 1,
        deadline_at = greatest(deadline_at, now() + interval '72 hours')
    where id = d.id returning * into d;
    insert into dispute_events (dispute_id, actor_side, actor_user_id, kind, body, amount_minor) values (d.id, p_side, p_user, 'offer', p_body, p_amount);
  elsif p_action = 'contest' then
    update disputes set status = 'escalated' where id = d.id returning * into d;
    insert into dispute_events (dispute_id, actor_side, actor_user_id, kind, body) values (d.id, p_side, p_user, 'contest', p_body);
  else
    raise exception 'unknown action' using errcode = 'BD003';
  end if;
  return d;
end $$;

-- Either side can ask for a reviewer at any time, and unanswered disputes escalate by themselves.
create or replace function escalate_dispute(p_dispute_id uuid, p_side text, p_user uuid, p_body text) returns disputes
language plpgsql as $$
declare d disputes;
begin
  update disputes set status = 'escalated' where id = p_dispute_id and status in ('awaiting_response', 'negotiating') returning * into d;
  if not found then raise exception 'this dispute cannot be escalated' using errcode = 'BD005'; end if;
  insert into dispute_events (dispute_id, actor_side, actor_user_id, kind, body) values (d.id, p_side, p_user, 'escalate', p_body);
  return d;
end $$;

create or replace function expire_disputes(p_now timestamptz default now()) returns int
language plpgsql as $$
declare
  d record;
  v_count int := 0;
begin
  for d in
    update disputes set status = 'escalated'
    where status in ('awaiting_response', 'negotiating') and deadline_at <= p_now
    returning id
  loop
    insert into dispute_events (dispute_id, actor_side, kind, body) values (d.id, 'platform', 'escalate', 'No agreement within the deadline.');
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Records the outcome, does the deposit capture when that is the resolution, and unfreezes the payout.
-- A refund to the renter has already been made through the refund flow: pass its payment id so the
-- payout shrinks by the provider's share.
create or replace function resolve_dispute(
  p_dispute_id uuid, p_resolution text, p_amount bigint, p_actor uuid, p_actor_side text, p_note text default null,
  p_refund_payment_id uuid default null
) returns disputes
language plpgsql as $$
declare
  d disputes;
  b bookings;
  dep payments;
  v_provider_part bigint := 0;
begin
  select * into d from disputes where id = p_dispute_id for update;
  if not found then raise exception 'dispute not found' using errcode = 'P0002'; end if;
  if d.status in ('resolved', 'dismissed') then raise exception 'this dispute is already closed' using errcode = 'BD005'; end if;
  select * into b from bookings where id = d.booking_id for update;

  if p_resolution = 'capture' then
    select * into dep from payments where booking_id = b.id and kind = 'deposit_hold' and status = 'succeeded' order by created_at limit 1;
    if not found then raise exception 'there is no deposit to capture' using errcode = 'BD004'; end if;
    if p_amount is null or p_amount <= 0 or p_amount > dep.amount_minor then raise exception 'capture amount is outside the deposit' using errcode = 'BD004'; end if;
    perform capture_deposit(dep.id, p_amount);
    update payouts set amount_minor = amount_minor + p_amount where booking_id = b.id and status in ('pending', 'frozen');
  elsif p_resolution = 'refund' then
    if p_refund_payment_id is null then raise exception 'a refund needs its payment' using errcode = 'BD004'; end if;
    select coalesce(provider_part_minor, 0) into v_provider_part from payments
      where id = p_refund_payment_id and booking_id = b.id and kind = 'refund' and status = 'succeeded';
    if not found then raise exception 'the refund has not succeeded' using errcode = 'BD004'; end if;
    update payouts
    set amount_minor = greatest(0, amount_minor - v_provider_part),
        status = case when amount_minor - v_provider_part <= 0 then 'cancelled' else status end
    where booking_id = b.id and status in ('pending', 'frozen');
  elsif p_resolution <> 'dismiss' then
    raise exception 'unknown resolution' using errcode = 'BD003';
  end if;

  -- Unfreeze: the provider is paid what remains, now.
  update payouts set status = 'pending', release_after = now() where booking_id = b.id and status = 'frozen';

  update disputes
  set status = case when p_resolution = 'dismiss' then 'dismissed' else 'resolved' end,
      resolution = p_resolution, agreed_amount_minor = coalesce(p_amount, agreed_amount_minor),
      resolved_at = now(), resolved_by = p_actor
  where id = d.id returning * into d;
  insert into dispute_events (dispute_id, actor_side, actor_user_id, kind, body, amount_minor)
  values (d.id, p_actor_side, p_actor, 'decision', p_note, p_amount);
  return d;
end $$;

-- ---------------------------------------------------------------
-- Trust and safety
-- ---------------------------------------------------------------
create table reports (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null check (kind in ('listing', 'user', 'message', 'review')),
  target_id        uuid not null,
  reporter_user_id uuid references auth.users(id) on delete set null,
  reason           text not null check (length(btrim(reason)) between 1 and 500),
  status           text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  handled_by       uuid references auth.users(id) on delete set null,
  handled_at       timestamptz,
  created_at       timestamptz not null default now()
);
create index reports_open_idx on reports(created_at) where status = 'open';
alter table reports enable row level security;

create table insurance_attestations (
  provider_id uuid not null references providers(id) on delete cascade,
  version     text not null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz not null default now(),
  primary key (provider_id, version)
);
alter table insurance_attestations enable row level security;
create policy "members read attestations" on insurance_attestations for select using (is_provider_member(provider_id));

create table user_flags (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  suspended  boolean not null default false,
  reason     text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table user_flags enable row level security;

create table risk_rules (
  id        uuid primary key default gen_random_uuid(),
  code      text not null unique check (code in ('very_high_value', 'repeat_guest_bookings', 'repeat_cancellations')),
  threshold jsonb not null,
  action    text not null default 'hold_for_review' check (action in ('hold_for_review', 'notify')),
  is_active boolean not null default true
);
alter table risk_rules enable row level security;
insert into risk_rules (code, threshold, action) values
  ('very_high_value', '{"min_total": 5000}', 'hold_for_review'),
  ('repeat_guest_bookings', '{"count": 3, "hours": 24}', 'hold_for_review'),
  ('repeat_cancellations', '{"count": 3, "days": 7}', 'notify');

alter table bookings
  add column risk_flags  text[] not null default '{}',
  add column risk_status text not null default 'clear' check (risk_status in ('clear', 'held', 'cleared'));

-- Flags a paid booking for manual review when a rule matches. It never cancels anything.
create or replace function evaluate_booking_risk(p_booking_id uuid) returns text[]
language plpgsql as $$
declare
  b bookings;
  rule risk_rules;
  v_flags text[] := '{}';
  v_hold boolean := false;
  v_n int;
begin
  select * into b from bookings where id = p_booking_id;
  if not found then return '{}'; end if;
  for rule in select * from risk_rules where is_active loop
    v_n := null;
    if rule.code = 'very_high_value' and b.total_amount >= (rule.threshold ->> 'min_total')::numeric then
      v_n := 1;
    elsif rule.code = 'repeat_guest_bookings' and b.guest_id is not null then
      select count(*) into v_n from bookings
      where guest_id = b.guest_id and created_at >= now() - make_interval(hours => (rule.threshold ->> 'hours')::int);
      if v_n < (rule.threshold ->> 'count')::int then v_n := null; end if;
    elsif rule.code = 'repeat_cancellations' and (b.user_id is not null or b.guest_id is not null) then
      select count(*) into v_n from bookings
      where status = 'cancelled' and created_at >= now() - make_interval(days => (rule.threshold ->> 'days')::int)
        and ((b.user_id is not null and user_id = b.user_id) or (b.guest_id is not null and guest_id = b.guest_id));
      if v_n < (rule.threshold ->> 'count')::int then v_n := null; end if;
    end if;
    if v_n is not null then
      v_flags := v_flags || rule.code;
      if rule.action = 'hold_for_review' then v_hold := true; end if;
    end if;
  end loop;
  update bookings
  set risk_flags = v_flags,
      risk_status = case when v_hold and risk_status <> 'cleared' then 'held' else risk_status end
  where id = b.id;
  return v_flags;
end $$;

create or replace function bookings_risk_trigger() returns trigger
language plpgsql as $$
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    perform evaluate_booking_risk(new.id);
  end if;
  return new;
end $$;
create trigger bookings_risk after update of payment_status on bookings
  for each row execute function bookings_risk_trigger();

-- A held booking cannot be handed over until a reviewer clears it.
create or replace function inspection_risk_gate() returns trigger
language plpgsql as $$
begin
  if new.kind = 'pickup' and exists (select 1 from bookings where id = new.booking_id and risk_status = 'held') then
    raise exception 'this booking is held for review' using errcode = 'BP011';
  end if;
  return new;
end $$;
create trigger inspection_risk_gate before insert on booking_inspections
  for each row execute function inspection_risk_gate();

-- Suspended accounts cannot make new bookings.
create or replace function bookings_suspension_gate() returns trigger
language plpgsql as $$
begin
  if new.user_id is not null and exists (select 1 from user_flags where user_id = new.user_id and suspended) then
    raise exception 'this account is suspended' using errcode = 'BS002';
  end if;
  return new;
end $$;
create trigger bookings_suspension_gate before insert on bookings
  for each row execute function bookings_suspension_gate();

-- Private owners must accept the insurance declaration before submitting a car for review.
create or replace function fleet_units_attestation_gate() returns trigger
language plpgsql as $$
begin
  if new.listing_status = 'pending_review' and old.listing_status is distinct from 'pending_review'
     and exists (select 1 from providers p where p.id = new.provider_id and p.type = 'individual')
     and not exists (select 1 from insurance_attestations a where a.provider_id = new.provider_id) then
    raise exception 'accept the insurance declaration before submitting a car' using errcode = 'BS001';
  end if;
  return new;
end $$;
create trigger fleet_units_attestation_gate before update of listing_status on fleet_units
  for each row execute function fleet_units_attestation_gate();

-- ---------------------------------------------------------------
-- Grants: every function is service-role only
-- ---------------------------------------------------------------
revoke all on function expire_licences(date) from public, anon, authenticated;
revoke all on function refresh_ratings(uuid, uuid) from public, anon, authenticated;
revoke all on function submit_review(uuid, text, uuid, int, jsonb, text) from public, anon, authenticated;
revoke all on function edit_review(uuid, uuid, int, jsonb, text) from public, anon, authenticated;
revoke all on function publish_due_reviews(timestamptz) from public, anon, authenticated;
revoke all on function reply_to_review(uuid, uuid, text) from public, anon, authenticated;
revoke all on function remove_review(uuid, text) from public, anon, authenticated;
revoke all on function open_dispute(uuid, text, uuid, text, bigint, text, text[]) from public, anon, authenticated;
revoke all on function respond_dispute(uuid, text, uuid, text, text, bigint, text[]) from public, anon, authenticated;
revoke all on function escalate_dispute(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function expire_disputes(timestamptz) from public, anon, authenticated;
revoke all on function resolve_dispute(uuid, text, bigint, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function evaluate_booking_risk(uuid) from public, anon, authenticated;
grant execute on function expire_licences(date) to service_role;
grant execute on function refresh_ratings(uuid, uuid) to service_role;
grant execute on function submit_review(uuid, text, uuid, int, jsonb, text) to service_role;
grant execute on function edit_review(uuid, uuid, int, jsonb, text) to service_role;
grant execute on function publish_due_reviews(timestamptz) to service_role;
grant execute on function reply_to_review(uuid, uuid, text) to service_role;
grant execute on function remove_review(uuid, text) to service_role;
grant execute on function open_dispute(uuid, text, uuid, text, bigint, text, text[]) to service_role;
grant execute on function respond_dispute(uuid, text, uuid, text, text, bigint, text[]) to service_role;
grant execute on function escalate_dispute(uuid, text, uuid, text) to service_role;
grant execute on function expire_disputes(timestamptz) to service_role;
grant execute on function resolve_dispute(uuid, text, bigint, uuid, text, text, uuid) to service_role;
grant execute on function evaluate_booking_risk(uuid) to service_role;
