-- 0018: security hardening from the September 2026 review.
--
-- 1. A member of a provider could approve their own car. The "owners and managers write units" policy lets them
--    insert and update fleet_units rows with the public API key, and listing_status defaults to 'approved', so a
--    direct API call could publish a car that staff never reviewed. The app itself writes through the service role,
--    so limit only requests made as the API roles (anon, authenticated): a car they add starts as a draft, they
--    cannot write the review note, and their only allowed status change is submitting a draft or a rejected car.
-- 2. daily_stats had no row level security and the two dashboard views (revenue by car and by country) were
--    readable by the API roles. They are read only by server code (service role).

create or replace function fleet_units_owner_guard() returns trigger
language plpgsql as $$
begin
  -- Server code (service role), staff tooling and migrations are not limited here.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.listing_status := 'draft';
    new.review_note := null;
    return new;
  end if;

  if new.review_note is distinct from old.review_note then
    raise exception 'only BestCar staff can write a review note' using errcode = 'BS003';
  end if;
  if new.listing_status is distinct from old.listing_status
     and not (old.listing_status in ('draft', 'rejected') and new.listing_status = 'pending_review') then
    raise exception 'a car is approved by BestCar staff, not by its owner' using errcode = 'BS003';
  end if;
  return new;
end $$;

create trigger fleet_units_owner_guard before insert or update on fleet_units
  for each row execute function fleet_units_owner_guard();

-- Legacy dashboard data: server side only.
alter table daily_stats enable row level security;
revoke all on daily_stats from anon, authenticated;
revoke all on v_best_sellers from anon, authenticated;
revoke all on v_sales_by_country from anon, authenticated;
revoke all on function refresh_daily_stats() from public, anon, authenticated;
grant execute on function refresh_daily_stats() to service_role;

-- 3. Upload buckets: the routes validate the declared type and size, but the bucket itself accepted anything, so a
--    caller who skipped the route could store any file of any size. Limit the buckets to what the app accepts
--    (5 MB, images and PDF). Only where the Storage schema exists.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    update storage.buckets
       set file_size_limit = 5242880,
           allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
     where id in ('provider-documents', 'customer-documents', 'booking-inspections');
  end if;
end $$;
