-- Demo data for the marketplace features. Additive and safe to run more than once: it never deletes or changes
-- existing rows, and every row it creates can be recognised (providers d101 and d102, promo WELCOME10, reviews and
-- disputes on old completed bookings).
--
-- What it adds:
--   * Extras (child seat, GPS, insurance) for the default provider, the WELCOME10 promo code and sample exchange rates.
--   * Two more providers with their own branches, cars, prices and policies: Northgate Car Hire (a company with
--     branches in London and Manchester, GBP) and Rafi's Corolla (a private owner in Dhaka, BDT).
--   * Published reviews (with some provider replies), a few disputes in different states and a few message threads on
--     completed bookings, so those pages have something to show.
--   * Optionally, your own account as owner of both new providers, so you can open the provider portal. Put your
--     email below before running it.
--
-- Run it in Supabase, SQL Editor, after migrations 0001-0017. No emails or texts are sent for this data: the
-- notification events it triggers are marked as processed at the end.

do $$
declare
  v_owner_email text := 'YOUR_EMAIL_HERE';   -- <- your account's email (leave as is to skip)
  v_started     timestamptz := now();   -- the start of this transaction, when the events below are created
  v_default     uuid := '00000000-0000-0000-0000-00000000b0c1';
  v_company     uuid := '00000000-0000-0000-0000-00000000d101';
  v_owner       uuid := '00000000-0000-0000-0000-00000000d102';
  v_user        uuid;
  v_london      int;
  v_manchester  int;
  v_dhaka       int;
  v_vehicle     record;
  v_booking     record;
  v_review      uuid;
  v_rating      int;
  v_roll        float;
  v_comment     text;
  v_thread      uuid;
  v_n           int := 0;
  v_have        int;
  v_good  text[] := array[
    'Smooth pick-up and the car was spotless. Would book again.',
    'Exactly as described and the price matched the quote. Easy hand-over.',
    'Friendly staff, quick paperwork, and the car drove beautifully on a long weekend trip.',
    'Great value for the week. Returned it in ten minutes with no fuss.',
    'Clear communication before arrival, and the car was ready when I got there.',
    'Very comfortable for a family of four. The child seat was included as promised.'];
  v_ok    text[] := array[
    'Good car overall. Pick-up took a little longer than expected.',
    'Fine for the price. A few scuffs were already noted on the sheet.',
    'Did the job. The fuel level at pick-up was lower than I hoped.'];
  v_bad   text[] := array[
    'The car was not as clean as the photos suggested and I waited a while at the desk.',
    'The final total was higher than I expected because of extras I did not need.'];
  v_reply text[] := array[
    'Thank you for renting with us, we hope to see you again soon.',
    'Glad it went well. Safe travels on your next trip.',
    'Thanks for the feedback, we have passed it to the team.'];
begin
  -- ---------------------------------------------------------------
  -- Extras, promo code, exchange rates
  -- ---------------------------------------------------------------
  insert into extras (provider_id, code, name, kind, pricing, unit_price_minor, currency, max_quantity, is_mandatory)
  values
    (v_default, 'seat', 'Child seat', 'extra', 'per_day', 800, 'USD', 2, false),
    (v_default, 'gps', 'GPS navigation', 'extra', 'per_day', 500, 'USD', 1, false),
    (v_default, 'cdw', 'Collision damage waiver', 'insurance', 'per_day', 1200, 'USD', 1, false)
  on conflict (provider_id, code) do nothing;

  if not exists (select 1 from promo_codes where lower(code) = 'welcome10') then
    insert into promo_codes (code, issuer, discount_type, value, min_days) values ('WELCOME10', 'platform', 'percent', 1000, 1);
  end if;

  insert into fx_rates (date, base, quote, rate) values
    (current_date, 'USD', 'EUR', 0.92), (current_date, 'USD', 'GBP', 0.79),
    (current_date, 'USD', 'BDT', 110), (current_date, 'USD', 'INR', 83)
  on conflict do nothing;

  -- ---------------------------------------------------------------
  -- Northgate Car Hire: a company with two branches (GBP)
  -- ---------------------------------------------------------------
  insert into providers (id, type, legal_name, display_name, country_code, default_currency, status)
  values (v_company, 'company', 'Northgate Car Hire Ltd', 'Northgate Car Hire', 'GB', 'GBP', 'approved')
  on conflict (id) do nothing;

  insert into branches (provider_id, code, name, city, country, country_code, currency, timezone)
  values
    (v_company, 'GB-LON', 'London Victoria', 'London', 'United Kingdom', 'GB', 'GBP', 'Europe/London'),
    (v_company, 'GB-MAN', 'Manchester Piccadilly', 'Manchester', 'United Kingdom', 'GB', 'GBP', 'Europe/London')
  on conflict (provider_id, code) do nothing;
  select id into v_london from branches where provider_id = v_company and code = 'GB-LON';
  select id into v_manchester from branches where provider_id = v_company and code = 'GB-MAN';
  insert into branch_private (branch_id, provider_id, address) values
    (v_london, v_company, '12 Buckingham Palace Road, London'), (v_manchester, v_company, '4 Station Approach, Manchester')
  on conflict do nothing;

  for v_vehicle in select id, slug, price_per_day from vehicles order by created_at, id limit 8 loop
    insert into fleet_units (provider_id, branch_id, vehicle_id, plate)
    values (v_company, v_london, v_vehicle.id, upper(left(v_vehicle.slug, 6)) || '-LON')
    on conflict (provider_id, plate) do nothing;
    insert into rate_plans (provider_id, vehicle_id, branch_id, currency, base_daily_minor, weekend_uplift_bp, weekly_discount_bp)
    values (v_company, v_vehicle.id, v_london, 'GBP', round(v_vehicle.price_per_day * 0.79 * 100), 1000, 1000)
    on conflict (vehicle_id, branch_id) do nothing;
  end loop;
  for v_vehicle in select id, slug, price_per_day from vehicles order by created_at, id offset 2 limit 5 loop
    insert into fleet_units (provider_id, branch_id, vehicle_id, plate)
    values (v_company, v_manchester, v_vehicle.id, upper(left(v_vehicle.slug, 6)) || '-MAN')
    on conflict (provider_id, plate) do nothing;
    insert into rate_plans (provider_id, vehicle_id, branch_id, currency, base_daily_minor, weekend_uplift_bp, weekly_discount_bp)
    values (v_company, v_vehicle.id, v_manchester, 'GBP', round(v_vehicle.price_per_day * 0.75 * 100), 1000, 1000)
    on conflict (vehicle_id, branch_id) do nothing;
  end loop;

  insert into extras (provider_id, code, name, kind, pricing, unit_price_minor, currency, max_quantity, is_mandatory)
  values
    (v_company, 'seat', 'Child seat', 'extra', 'per_day', 600, 'GBP', 2, false),
    (v_company, 'cdw', 'Collision damage waiver', 'insurance', 'per_day', 950, 'GBP', 1, true)
  on conflict (provider_id, code) do nothing;
  insert into provider_policies (provider_id, deposit_type, deposit_value, cancellation_tiers, min_driver_age)
  values (v_company, 'fixed', 25000, '[{"hours_before": 48, "refund_bp": 10000}, {"hours_before": 0, "refund_bp": 0}]'::jsonb, 21)
  on conflict (provider_id) do nothing;

  -- ---------------------------------------------------------------
  -- Rafi's Corolla: a private owner in Dhaka (BDT), bookable inside availability windows
  -- ---------------------------------------------------------------
  insert into providers (id, type, legal_name, display_name, country_code, default_currency, status)
  values (v_owner, 'individual', 'Rafiqul Islam', 'Rafi''s Corolla', 'BD', 'BDT', 'approved')
  on conflict (id) do nothing;

  insert into branches (provider_id, code, name, city, country, country_code, currency, timezone)
  values (v_owner, 'BD-DHK', 'Gulshan pick-up', 'Dhaka', 'Bangladesh', 'BD', 'BDT', 'Asia/Dhaka')
  on conflict (provider_id, code) do nothing;
  select id into v_dhaka from branches where provider_id = v_owner and code = 'BD-DHK';
  insert into branch_private (branch_id, provider_id, address) values (v_dhaka, v_owner, 'Gulshan 2, Dhaka') on conflict do nothing;

  for v_vehicle in select id, slug, price_per_day from vehicles order by created_at, id offset 1 limit 2 loop
    insert into fleet_units (provider_id, branch_id, vehicle_id, plate, requires_window)
    values (v_owner, v_dhaka, v_vehicle.id, upper(left(v_vehicle.slug, 6)) || '-DHK', true)
    on conflict (provider_id, plate) do nothing;
    insert into rate_plans (provider_id, vehicle_id, branch_id, currency, base_daily_minor, weekend_uplift_bp, weekly_discount_bp)
    values (v_owner, v_vehicle.id, v_dhaka, 'BDT', round(v_vehicle.price_per_day * 110 * 100), 0, 1000)
    on conflict (vehicle_id, branch_id) do nothing;
    insert into availability_windows (fleet_unit_id, provider_id, during)
    select u.id, v_owner, tstzrange(date_trunc('day', now()), date_trunc('day', now()) + interval '120 days', '[)')
    from fleet_units u where u.provider_id = v_owner and u.vehicle_id = v_vehicle.id
      and not exists (select 1 from availability_windows w where w.fleet_unit_id = u.id);
  end loop;

  insert into provider_policies (provider_id, deposit_type, deposit_value, cancellation_tiers, min_driver_age)
  values (v_owner, 'fixed', 2000000, '[{"hours_before": 24, "refund_bp": 10000}, {"hours_before": 0, "refund_bp": 0}]'::jsonb, 23)
  on conflict (provider_id) do nothing;

  -- ---------------------------------------------------------------
  -- Your account becomes the owner of both, so the provider portal has something to open
  -- ---------------------------------------------------------------
  select id into v_user from auth.users where lower(email) = lower(v_owner_email);
  if v_user is not null then
    insert into provider_members (provider_id, user_id, role) values (v_company, v_user, 'owner'), (v_owner, v_user, 'owner')
    on conflict do nothing;
  end if;

  -- ---------------------------------------------------------------
  -- Reviews (published) with some replies, on completed bookings that have none yet
  -- ---------------------------------------------------------------
  for v_booking in
    select b.id, b.vehicle_id, b.provider_id, b.completed_at, b.user_id
    from bookings b
    where b.status = 'completed' and b.payment_status = 'paid' and b.provider_id = v_default
      and not exists (select 1 from reviews r where r.booking_id = b.id and r.direction = 'customer_to_provider')
    order by b.completed_at desc
    limit greatest(0, 60 - (select count(*) from reviews))
  loop
    v_roll := random();
    v_rating := case when v_roll < 0.52 then 5 when v_roll < 0.82 then 4 when v_roll < 0.94 then 3 when v_roll < 0.98 then 2 else 1 end;
    v_comment := case
      when random() < 0.25 then null
      when v_rating >= 4 then v_good[1 + floor(random() * array_length(v_good, 1))::int]
      when v_rating = 3 then v_ok[1 + floor(random() * array_length(v_ok, 1))::int]
      else v_bad[1 + floor(random() * array_length(v_bad, 1))::int] end;
    insert into reviews (booking_id, direction, author_user_id, subject_provider_id, vehicle_id, overall, aspects, comment,
                         status, submitted_at, published_at)
    values (v_booking.id, 'customer_to_provider', v_booking.user_id, v_booking.provider_id, v_booking.vehicle_id, v_rating,
            jsonb_build_object('cleanliness', greatest(1, least(5, v_rating + (case when random() < 0.3 then -1 else 0 end))),
                               'accuracy', v_rating, 'communication', greatest(1, least(5, v_rating + (case when random() < 0.3 then 1 else 0 end))),
                               'value', greatest(1, least(5, v_rating - (case when random() < 0.2 then 1 else 0 end)))),
            v_comment, 'published', v_booking.completed_at + interval '1 day', v_booking.completed_at + interval '2 days')
    returning id into v_review;
    if v_rating >= 4 and v_comment is not null and random() < 0.4 then
      insert into review_replies (review_id, provider_id, body, created_at)
      values (v_review, v_booking.provider_id, v_reply[1 + floor(random() * array_length(v_reply, 1))::int], v_booking.completed_at + interval '3 days');
    end if;
    v_n := v_n + 1;
  end loop;

  -- ---------------------------------------------------------------
  -- Disputes in three states, on old completed bookings without one
  -- ---------------------------------------------------------------
  select count(*) into v_have from disputes;
  if v_have < 3 then
  insert into disputes (booking_id, opened_by_side, type, status, currency, claimed_amount_minor, offer_minor, offer_by_side,
                        offer_count, deadline_at, created_at)
  select b.id, 'provider', 'damage', 'awaiting_response', b.currency, 12000, null, null, 0, now() + interval '48 hours', now() - interval '1 day'
  from bookings b
  where b.status = 'completed' and b.provider_id = v_default
    and not exists (select 1 from disputes d where d.booking_id = b.id)
  order by b.completed_at desc offset 0 limit 1;

  insert into disputes (booking_id, opened_by_side, type, status, currency, claimed_amount_minor, offer_minor, offer_by_side,
                        offer_count, deadline_at, created_at)
  select b.id, 'customer', 'overcharge', 'negotiating', b.currency, 4500, 2000, 'provider', 1, now() + interval '5 days', now() - interval '3 days'
  from bookings b
  where b.status = 'completed' and b.provider_id = v_default
    and not exists (select 1 from disputes d where d.booking_id = b.id)
  order by b.completed_at desc offset 1 limit 1;

  insert into disputes (booking_id, opened_by_side, type, status, currency, claimed_amount_minor, agreed_amount_minor, resolution,
                        deadline_at, resolved_at, created_at)
  select b.id, 'provider', 'cleanliness_or_fees', 'resolved', b.currency, 3000, 2000, 'capture', now() - interval '10 days', now() - interval '12 days', now() - interval '20 days'
  from bookings b
  where b.status = 'completed' and b.provider_id = v_default
    and not exists (select 1 from disputes d where d.booking_id = b.id)
  order by b.completed_at desc offset 2 limit 1;
  end if;

  -- ---------------------------------------------------------------
  -- Message threads on four recent completed bookings
  -- ---------------------------------------------------------------
  select count(*) into v_have from message_threads;
  for v_booking in
    select b.id, b.provider_id, b.user_id, b.completed_at from bookings b
    where b.status = 'completed' and b.provider_id = v_default
      and not exists (select 1 from message_threads t where t.booking_id = b.id)
    order by b.completed_at desc limit greatest(0, 4 - v_have)
  loop
    insert into message_threads (booking_id, customer_user_id, provider_id, created_at, last_message_at)
    values (v_booking.id, v_booking.user_id, v_booking.provider_id, v_booking.completed_at - interval '3 days', v_booking.completed_at - interval '2 days')
    returning id into v_thread;
    insert into messages (thread_id, sender_side, body, created_at) values
      (v_thread, 'customer', 'Hi, what time can I collect the car on the first day?', v_booking.completed_at - interval '3 days'),
      (v_thread, 'provider', 'Good morning. We open at 8:00, and the car will be ready from then. Please bring your licence.', v_booking.completed_at - interval '3 days' + interval '40 minutes'),
      (v_thread, 'customer', 'Perfect, thank you. See you then.', v_booking.completed_at - interval '2 days');
  end loop;

  -- No emails or texts for demo data.
  update outbox_events set status = 'processed', processed_at = now(), last_error = 'demo data'
  where created_at >= v_started and status = 'pending';

  raise notice 'Demo data added. New reviews: %', v_n;
end $$;
