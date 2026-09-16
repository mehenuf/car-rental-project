-- Atomic stock adjustment for vehicles, replacing the app-level
-- read-then-write that let two concurrent bookings both pass the
-- availability check and both decrement from the same stale count.
--
-- decrement_vehicle_stock: called right before a booking is inserted.
-- The `where stock > 0` guard makes the update itself the availability
-- check — it affects zero rows (and the caller aborts the booking)
-- exactly when a concurrent request already took the last unit.
create or replace function decrement_vehicle_stock(p_vehicle_id uuid)
returns table (id uuid, stock int, available boolean)
language sql
as $$
  update vehicles
  set stock = stock - 1,
      available = (stock - 1) > 0
  where vehicles.id = p_vehicle_id
    and stock > 0
  returning vehicles.id, vehicles.stock, vehicles.available;
$$;

-- increment_vehicle_stock: called when a booking is cancelled, to give
-- back the unit it had reserved.
create or replace function increment_vehicle_stock(p_vehicle_id uuid)
returns table (id uuid, stock int, available boolean)
language sql
as $$
  update vehicles
  set stock = stock + 1,
      available = true
  where vehicles.id = p_vehicle_id
  returning vehicles.id, vehicles.stock, vehicles.available;
$$;
