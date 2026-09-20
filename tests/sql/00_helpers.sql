create schema test;
grant usage on schema test to public;

create function test.assert(p_cond boolean, p_msg text) returns void
language plpgsql as $$
begin
  if p_cond is not true then
    raise exception 'ASSERT FAILED: %', p_msg;
  end if;
end $$;

-- Runs p_sql and requires it to fail with exactly p_sqlstate.
create function test.expect_error(p_sql text, p_sqlstate text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_sqlstate then return; end if;
    raise exception 'expected SQLSTATE %, got % (%) for: %', p_sqlstate, sqlstate, sqlerrm, p_sql;
  end;
  raise exception 'expected SQLSTATE % but statement succeeded: %', p_sqlstate, p_sql;
end $$;
