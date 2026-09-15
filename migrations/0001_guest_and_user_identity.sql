-- Adds guest-browser and authenticated-customer identity to bookings, so a
-- booking history / dashboard can be shown without requiring login.
--
-- Non-destructive: safe to run against an already-seeded database. Run this
-- in the Supabase SQL editor after schema.sql has been applied once.

alter table bookings
  add column if not exists guest_id uuid,
  add column if not exists user_id  uuid references auth.users(id) on delete set null;

create index if not exists bookings_guest_idx on bookings(guest_id);
create index if not exists bookings_user_idx  on bookings(user_id);

comment on column bookings.guest_id is
  'Random ID issued in an httpOnly cookie to a non-logged-in browser so it can look up its own booking history. Null once the visitor is authenticated (user_id is used instead).';
comment on column bookings.user_id is
  'Supabase auth.users id when the booking was made while signed in. Null for guest checkouts.';
