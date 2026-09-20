-- Legacy status mapping.
select test.assert((select status from bookings where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'completed', 'past success -> completed');
select test.assert((select status from bookings where id = 'aaaaaaaa-0000-0000-0000-000000000002') = 'confirmed', 'future success -> confirmed');
select test.assert((select status from bookings where id = 'aaaaaaaa-0000-0000-0000-000000000003') = 'cancelled', 'cancelled stays cancelled');
select test.assert((select status from bookings where id = 'aaaaaaaa-0000-0000-0000-000000000004') = 'pending', 'pending stays pending');
select test.expect_error($$update bookings set status = 'success' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, '23514');

-- Column backfill from the legacy location ids.
select test.assert((select pickup_branch_id from bookings where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 1, 'pickup_branch_id copied from pickup_location_id');
select test.assert((select currency from bookings where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'USD', 'currency backfilled');
select test.assert((select provider_id from bookings where id = 'aaaaaaaa-0000-0000-0000-000000000001') = '00000000-0000-0000-0000-00000000b0c1', 'provider backfilled');

-- Revenue views count confirmed/active/completed only (civic: completed + confirmed + cancelled).
select test.assert((select sales_count from v_best_sellers where id = '11111111-1111-1111-1111-111111111111') = 2, 'best sellers count revenue statuses');
select test.assert((select sales_count from v_sales_by_country where country_code = 'AE') = 2, 'sales by country joins branches');

-- The full transition matrix (mirror of src/lib/booking-state.ts).
do $$
declare
  s text; t text; n int := 0; bid uuid;
  legal text[] := array['pending>confirmed','pending>cancelled','confirmed>active','confirmed>cancelled','confirmed>no_show','active>completed'];
begin
  foreach s in array array['pending','confirmed','active','completed','cancelled','no_show'] loop
    foreach t in array array['pending','confirmed','active','completed','cancelled','no_show'] loop
      n := n + 1;
      bid := gen_random_uuid();
      insert into bookings (id, reference, customer_name, email, pickup_at, dropoff_at, total_amount, status)
      values (bid, 'BC-M' || lpad(n::text, 5, '0'), 'Matrix', 'm@example.com', now() + interval '1 day', now() + interval '2 days', 1, s);
      if (s || '>' || t) = any (legal) then
        perform transition_booking(bid, t);
        if (select status from bookings where id = bid) <> t then
          raise exception 'matrix: % -> % did not apply', s, t;
        end if;
      else
        perform test.expect_error(format('select transition_booking(%L, %L)', bid, t), 'BC001');
      end if;
    end loop;
  end loop;
end $$;

select test.expect_error($$select transition_booking('99999999-9999-9999-9999-999999999999', 'confirmed')$$, 'P0002');
