select test.assert(to_regclass('public.locations') is null, 'locations table is dropped');
select test.assert(to_regprocedure('decrement_vehicle_stock(uuid)') is null, 'decrement_vehicle_stock is dropped');
select test.assert(to_regprocedure('increment_vehicle_stock(uuid)') is null, 'increment_vehicle_stock is dropped');
select test.assert(not exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'bookings'
    and column_name in ('pickup_location_id', 'dropoff_location_id')
), 'legacy booking location columns are dropped');
select test.assert((select confrelid::regclass::text from pg_constraint where conname = 'vehicles_location_id_fkey') = 'branches', 'vehicles.location_id references branches');
select test.assert((select count(*) from v_sales_by_country) >= 1, 'sales by country still works without locations');
select test.assert((select count(*) from v_best_sellers) >= 3, 'best sellers still works');
