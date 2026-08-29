-- Car rental platform — Digital Pylot assessment
-- Target: Supabase (Postgres 15) free tier. Also runs on local Postgres / Neon.
-- Run in Supabase SQL editor, then run seed.ts.

drop table if exists leads cascade;
drop table if exists bookings cascade;
drop table if exists vehicles cascade;
drop table if exists locations cascade;
drop table if exists daily_stats cascade;

-- ---------------------------------------------------------------
-- locations
-- ---------------------------------------------------------------
create table locations (
  id          serial primary key,
  city        text not null,
  country     text not null,
  country_code char(2) not null,          -- drives the "Sales by Countries" widget
  created_at  timestamptz default now()
);

-- ---------------------------------------------------------------
-- vehicles
-- ---------------------------------------------------------------
create table vehicles (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  name           text not null,
  brand          text not null,
  category       text not null check (category in ('popular','large','small','exclusive')),
  price_per_day  numeric(10,2) not null,
  seats          int not null default 5,
  doors          int not null default 4,
  transmission   text not null check (transmission in ('automatic','manual')),
  fuel           text not null check (fuel in ('petrol','diesel','hybrid','electric')),
  image_url      text not null,
  gallery        text[] default '{}',
  description    text,
  features       text[] default '{}',      -- ['GPS','Bluetooth','Child seat']
  rating         numeric(2,1) default 4.5,
  review_count   int default 0,
  stock          int not null default 3,   -- feeds "Low Stocks" in the sidebar
  available      boolean default true,
  location_id    int references locations(id),
  created_at     timestamptz default now()
);

create index vehicles_category_idx on vehicles(category);
create index vehicles_price_idx    on vehicles(price_per_day);
create index vehicles_available_idx on vehicles(available);

-- ---------------------------------------------------------------
-- bookings  (powers Recent Transactions, Sales Analytics, Best Seller)
-- ---------------------------------------------------------------
create table bookings (
  id                uuid primary key default gen_random_uuid(),
  reference         text unique not null,  -- e.g. 'BC-4F82A1'
  vehicle_id        uuid references vehicles(id) on delete set null,
  customer_name     text not null,
  email             text not null,
  phone             text,
  pickup_location_id  int references locations(id),
  dropoff_location_id int references locations(id),
  pickup_at         timestamptz not null,
  dropoff_at        timestamptz not null,
  days              int generated always as
                      (greatest(1, extract(day from (dropoff_at - pickup_at))::int)) stored,
  total_amount      numeric(10,2) not null,
  payment_method    text check (payment_method in ('paypal','stripe','apple_pay','payu','paytm')),
  status            text not null default 'pending'
                      check (status in ('success','pending','cancelled')),
  lead_score        int check (lead_score between 0 and 100),
  source            text default 'web' check (source in ('web','chat','phone')),
  created_at        timestamptz default now()
);

create index bookings_created_idx on bookings(created_at desc);
create index bookings_status_idx  on bookings(status);
create index bookings_vehicle_idx on bookings(vehicle_id);

-- ---------------------------------------------------------------
-- leads  (written by the AI qualification call)
-- ---------------------------------------------------------------
create table leads (
  id             uuid primary key default gen_random_uuid(),
  name           text,
  email          text,
  phone          text,
  intent_summary text,                    -- Claude/Llama-generated one-liner
  budget_band    text check (budget_band in ('low','mid','high','unknown')),
  urgency        text check (urgency in ('immediate','this_week','browsing','unknown')),
  score          int not null check (score between 0 and 100),
  next_action    text,
  transcript     jsonb,                   -- the chat that produced the score
  source         text default 'chat',
  notified       boolean default false,   -- set true after n8n webhook succeeds
  created_at     timestamptz default now()
);

create index leads_score_idx on leads(score desc);

-- ---------------------------------------------------------------
-- daily_stats  (pre-aggregated so the dashboard never scans bookings)
-- Refresh with the function below after seeding.
-- ---------------------------------------------------------------
create table daily_stats (
  date        date primary key,
  revenue     numeric(12,2) default 0,
  sales_count int default 0,
  purchases   int default 0
);

create or replace function refresh_daily_stats() returns void as $$
begin
  delete from daily_stats;
  insert into daily_stats (date, revenue, sales_count, purchases)
  select date_trunc('day', created_at)::date,
         sum(total_amount) filter (where status = 'success'),
         count(*) filter (where status = 'success'),
         count(*)
  from bookings
  group by 1;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------
-- Views the dashboard reads directly
-- ---------------------------------------------------------------
create or replace view v_best_sellers as
select v.id, v.name, v.brand, v.image_url, v.price_per_day,
       count(b.id) as sales_count,
       coalesce(sum(b.total_amount), 0) as revenue
from vehicles v
left join bookings b on b.vehicle_id = v.id and b.status = 'success'
group by v.id
order by sales_count desc;

create or replace view v_sales_by_country as
select l.country, l.country_code,
       count(b.id) as sales_count,
       coalesce(sum(b.total_amount), 0) as revenue
from bookings b
join locations l on l.id = b.pickup_location_id
where b.status = 'success'
group by l.country, l.country_code
order by sales_count desc;

-- ---------------------------------------------------------------
-- Row Level Security — enable, then allow public read only.
-- Writes go through Next.js route handlers using the service role key.
-- ---------------------------------------------------------------
alter table vehicles  enable row level security;
alter table locations enable row level security;
alter table bookings  enable row level security;
alter table leads     enable row level security;

create policy "public read vehicles"  on vehicles  for select using (true);
create policy "public read locations" on locations for select using (true);
-- bookings and leads: no public policy. Server-side only.
