-- Contract step. Apply only AFTER the application code that no longer uses
-- locations, pickup_location_id/dropoff_location_id or the stock RPCs is deployed.

drop function if exists decrement_vehicle_stock(uuid);
drop function if exists increment_vehicle_stock(uuid);

alter table bookings
  drop column pickup_location_id,
  drop column dropoff_location_id;

-- vehicles.location_id stays as the catalogue "home branch" hint used when a
-- vehicle is created; branch ids equal the old location ids, so values are valid.
alter table vehicles drop constraint if exists vehicles_location_id_fkey;
alter table vehicles
  add constraint vehicles_location_id_fkey
  foreign key (location_id) references branches(id) on delete set null;

drop table locations;
