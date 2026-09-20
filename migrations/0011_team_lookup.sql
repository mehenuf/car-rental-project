-- Lets the server find an existing account by email so a provider owner can add a
-- colleague to the team. PostgREST does not expose the auth schema, and letting
-- browsers query it would leak which emails have accounts, so this is service-role only.
create or replace function find_user_by_email(p_email text) returns uuid
language sql stable security definer set search_path = public, auth as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;

revoke all on function find_user_by_email(text) from public, anon, authenticated;
grant execute on function find_user_by_email(text) to service_role;
