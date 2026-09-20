-- Legacy (pre-marketplace) data, loaded before migration 0003 so the backfills are tested.
insert into locations (id, city, country, country_code) values
  (1, 'Dubai', 'United Arab Emirates', 'AE'),
  (2, 'Austin', 'United States', 'US');
select setval(pg_get_serial_sequence('locations', 'id'), 2);

insert into vehicles (id, slug, name, brand, category, price_per_day, transmission, fuel, image_url, stock, location_id) values
  ('11111111-1111-1111-1111-111111111111', 'civic', 'Honda Civic', 'Honda', 'popular', 48, 'automatic', 'petrol', 'http://x/i.jpg', 2, 1),
  ('22222222-2222-2222-2222-222222222222', 'tahoe', 'Chevy Tahoe', 'Chevrolet', 'large', 99, 'automatic', 'petrol', 'http://x/i.jpg', 0, 2),
  ('33333333-3333-3333-3333-333333333333', 'mini', 'Mini Cooper', 'Mini', 'small', 60, 'manual', 'petrol', 'http://x/i.jpg', 1, null);

insert into bookings (id, reference, vehicle_id, customer_name, email, pickup_location_id, dropoff_location_id, pickup_at, dropoff_at, total_amount, status) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'BC-000001', '11111111-1111-1111-1111-111111111111', 'Past Paid',   'a@example.com', 1, 1, '2026-01-10 10:00+00', '2026-01-12 10:00+00', 96, 'success'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'BC-000002', '11111111-1111-1111-1111-111111111111', 'Future Paid', 'b@example.com', 1, 1, now() + interval '10 days', now() + interval '12 days', 96, 'success'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'BC-000003', '11111111-1111-1111-1111-111111111111', 'Cancelled',   'c@example.com', 1, 1, now() + interval '3 days', now() + interval '4 days', 48, 'cancelled'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'BC-000004', '33333333-3333-3333-3333-333333333333', 'Pending',     'd@example.com', null, null, now() + interval '5 days', now() + interval '6 days', 60, 'pending');
