insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-0000000000e1', 'Colleague@Example.com'),
  ('cccccccc-0000-0000-0000-0000000000e2', 'other@example.com');

select test.assert(find_user_by_email('colleague@example.com') = 'cccccccc-0000-0000-0000-0000000000e1', 'finds a user by email, ignoring case');
select test.assert(find_user_by_email('  COLLEAGUE@example.com ') = 'cccccccc-0000-0000-0000-0000000000e1', 'and ignoring surrounding spaces');
select test.assert(find_user_by_email('nobody@example.com') is null, 'returns null for an unknown email');
select test.assert(not has_function_privilege('anon', 'find_user_by_email(text)', 'execute'), 'anon cannot look up users');
select test.assert(not has_function_privilege('authenticated', 'find_user_by_email(text)', 'execute'), 'signed-in users cannot look up users');
select test.assert(has_function_privilege('service_role', 'find_user_by_email(text)', 'execute'), 'the service role can');
