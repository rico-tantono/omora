-- OMORA access checks: who can see and change what.
--
-- How to run: Supabase dashboard > SQL Editor > New query > paste this whole file > Run.
-- Run all five migrations first. Nothing is kept: it creates three throwaway users, tests the rules while
-- acting as each of them, and rolls everything back at the end.
--
-- Success: the last result shows "ALL ACCESS CHECKS PASSED".
-- Failure: the query stops with an error that says which rule did not hold. Copy it and send it to me.
--
-- A = Alice (owns a group), B = Bob (Alice's connection and group member), C = Carol (a stranger).
-- Storage files are not covered here; check those with the manual steps in the README.

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'rls-a@example.test', '{"username":"rls_alice"}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'rls-b@example.test', '{"username":"rls_bob"}'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'rls-c@example.test', '{"username":"rls_carol"}');

do $$
begin
  assert (select count(*) from public.profiles where id in
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc')) = 3,
    'Signing up should create a profile for each new user (the trigger from the first migration)';
  assert (select username from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 'rls_alice',
    'The profile username should come from the signup details';
end $$;

-- ===========================================================================
-- As Alice: ask Bob to connect, make a group, invite Bob, and create memories
-- ===========================================================================
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  a constant uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  g uuid;
  m_private uuid;
  m_conn uuid;
  m_group uuid;
  blocked boolean := false;
begin
  perform public.send_friend_request('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

  g := public.create_group('Test group', 'rls check', null, null);
  perform set_config('app.group', g::text, true);
  perform public.invite_to_group(g, 'rls_bob');

  insert into public.memories (owner_id, title, place_name, lat, lng, visit_date, visibility)
    values (a, 'private one', 'p', 1, 1, current_date, 'private') returning id into m_private;
  insert into public.memories (owner_id, title, place_name, lat, lng, visit_date, visibility)
    values (a, 'connections one', 'p', 1, 1, current_date, 'connections') returning id into m_conn;
  insert into public.memories (owner_id, title, place_name, lat, lng, visit_date, visibility, group_id)
    values (a, 'group one', 'p', 1, 1, current_date, 'private', g) returning id into m_group;
  perform set_config('app.m_private', m_private::text, true);
  perform set_config('app.m_conn', m_conn::text, true);
  perform set_config('app.m_group', m_group::text, true);

  insert into public.memory_photos (memory_id, owner_id, storage_path)
    values (m_private, a, a || '/' || m_private || '/p.jpg'), (m_group, a, a || '/' || m_group || '/g.jpg');

  -- at most 6 photos on one memory
  for i in 1..5 loop
    insert into public.memory_photos (memory_id, owner_id, storage_path)
      values (m_conn, a, a || '/' || m_conn || '/' || i || '.jpg');
  end loop;
  begin
    insert into public.memory_photos (memory_id, owner_id, storage_path)
      values (m_conn, a, a || '/' || m_conn || '/6.jpg');
    insert into public.memory_photos (memory_id, owner_id, storage_path)
      values (m_conn, a, a || '/' || m_conn || '/7.jpg');
  exception when others then
    blocked := true;
  end;
  assert blocked, 'A memory should not accept a 7th photo';

  assert (select count(*) from public.memories where owner_id = a) = 3, 'Alice should see her own three memories';
end $$;

-- ===========================================================================
-- As Bob: accept the connection and the invitation, then check what he can see
-- ===========================================================================
reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  a constant uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  b constant uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  g uuid := current_setting('app.group')::uuid;
  m_private uuid := current_setting('app.m_private')::uuid;
  m_conn uuid := current_setting('app.m_conn')::uuid;
  m_group uuid := current_setting('app.m_group')::uuid;
  n integer;
  blocked boolean;
begin
  perform public.respond_to_friend_request(a, true);
  perform public.respond_to_invite(g, true);

  assert (select count(*) from public.memories where id = m_conn) = 1, 'A connection should see a "connections" memory';
  assert (select count(*) from public.memories where id = m_group) = 1, 'A group member should see a group memory';
  assert (select count(*) from public.memories where id = m_private) = 0, 'Nobody else should see a private memory, even a connection';
  assert (select count(*) from public.memory_photos where memory_id = m_group) = 1, 'A group member should see the photos of a group memory';
  assert (select count(*) from public.memory_photos where memory_id = m_private) = 0, 'Photos of a private memory should stay hidden';
  assert (select count(*) from public.profiles where id = a) = 1, 'A connection who is also a group member should see the profile';

  update public.memories set title = 'hacked' where id = m_conn;
  get diagnostics n = row_count;
  assert n = 0, 'Bob must not be able to edit Alice''s memory';

  delete from public.memories where id = m_conn;
  get diagnostics n = row_count;
  assert n = 0, 'Bob must not be able to delete Alice''s memory';

  blocked := false;
  begin
    insert into public.memories (owner_id, title, place_name, lat, lng, visit_date)
      values (a, 'forged', 'p', 1, 1, current_date);
  exception when others then blocked := true;
  end;
  assert blocked, 'Bob must not be able to create a memory in Alice''s name';

  blocked := false;
  begin
    insert into public.group_members (group_id, user_id, role, status) values (g, b, 'owner', 'member');
  exception when others then blocked := true;
  end;
  assert blocked, 'Membership must only change through the functions, never by writing the table directly';

  blocked := false;
  begin
    update public.profiles set created_at = now() where id = b;
  exception when others then blocked := true;
  end;
  assert blocked, 'A user must not be able to change protected profile columns';

  update public.profiles set bio = 'hello' where id = b;
  get diagnostics n = row_count;
  assert n = 1, 'Bob should be able to edit his own bio';

  -- Bob adds a memory to the group; Alice should see it until Bob leaves
  insert into public.memories (owner_id, title, place_name, lat, lng, visit_date, visibility, group_id)
    values (b, 'bob group memory', 'p', 1, 1, current_date, 'private', g) returning id into m_group;
  perform set_config('app.m_bob_group', m_group::text, true);
end $$;

-- ===========================================================================
-- As Alice again: she sees Bob's group memory
-- ===========================================================================
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  assert (select count(*) from public.memories where id = current_setting('app.m_bob_group')::uuid) = 1,
    'A group owner should see a memory a member added to the group';
end $$;

-- ===========================================================================
-- As Carol (a stranger): she must see nothing of Alice's or Bob's
-- ===========================================================================
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  g uuid := current_setting('app.group')::uuid;
  blocked boolean;
begin
  assert (select count(*) from public.memories) = 0, 'A stranger should see no memories';
  assert (select count(*) from public.memory_photos) = 0, 'A stranger should see no photos';
  assert (select count(*) from public.groups) = 0, 'A stranger should see no groups';
  assert (select count(*) from public.group_members) = 0, 'A stranger should see no group members';
  assert (select count(*) from public.friendships) = 0, 'A stranger should see no friendships';
  assert (select count(*) from public.profiles where id <> 'cccccccc-cccc-cccc-cccc-cccccccccccc') = 0,
    'A stranger should only be able to read their own profile directly';

  blocked := false;
  begin
    insert into public.memories (owner_id, title, place_name, lat, lng, visit_date, visibility, group_id)
      values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'sneaky', 'p', 1, 1, current_date, 'private', g);
  exception when others then blocked := true;
  end;
  assert blocked, 'Nobody should be able to put a memory in a group they are not in';

  blocked := false;
  begin
    perform public.invite_to_group(g, 'rls_bob');
  exception when others then blocked := true;
  end;
  assert blocked, 'Only the group owner should be able to invite people';

  assert (select count(*) from public.search_profiles('rls_alice')) = 1, 'A public profile should be found by search';
end $$;

-- Alice makes her profile "connections only": found only by the exact username
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
update public.profiles set visibility = 'connections' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  assert (select count(*) from public.search_profiles('rls_ali')) = 0, '"Connections only" profiles should not appear in partial searches';
  assert (select count(*) from public.search_profiles('rls_alice')) = 1, '"Connections only" profiles should be found by the exact username';
end $$;

-- Alice makes her profile private: nobody unconnected can find her at all
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
update public.profiles set visibility = 'private' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  assert (select count(*) from public.search_profiles('rls_alice')) = 0, 'A private profile should not be found by a stranger';
end $$;

-- Carol makes her profile private too; Alice, the group owner, must not be able to invite her by username
update public.profiles set visibility = 'private' where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  blocked boolean := false;
begin
  begin
    perform public.invite_to_group(current_setting('app.group')::uuid, 'rls_carol');
  exception when others then blocked := true;
  end;
  assert blocked, 'A private profile should not be invitable by username by someone not connected to it';
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  assert (select count(*) from public.search_profiles('rls_alice')) = 1, 'A private profile should still be found by its connections';
end $$;

-- ===========================================================================
-- Bob leaves the group: his memory goes back to being private
-- ===========================================================================
do $$
begin
  perform public.leave_group(current_setting('app.group')::uuid);
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  assert (select count(*) from public.memories where id = current_setting('app.m_bob_group')::uuid) = 0,
    'A memory should leave the group, and Alice''s view, when its author leaves';
end $$;

reset role;
do $$
declare
  r record;
begin
  select group_id, visibility into r from public.memories where id = current_setting('app.m_bob_group')::uuid;
  assert r.group_id is null and r.visibility = 'private', 'The memory should go back to its author as a private memory';
end $$;

-- ===========================================================================
-- Signed-out visitors
-- ===========================================================================
set local role anon;
do $$
declare
  blocked boolean := false;
begin
  begin
    perform count(*) from public.profiles;
  exception when others then blocked := true;
  end;
  assert blocked, 'Signed-out visitors must not be able to read profiles';

  blocked := false;
  begin
    perform count(*) from public.memories;
  exception when others then blocked := true;
  end;
  assert blocked, 'Signed-out visitors must not be able to read memories';

  assert public.is_username_available('rls_alice') = false, 'The signup username check should work before signing in';
end $$;

-- ===========================================================================
-- Deleting an account removes it and everything in it
-- ===========================================================================
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);
set local role authenticated;
select public.delete_my_account();

reset role;
do $$
begin
  assert not exists (select 1 from auth.users where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'), 'The account should be deleted';
  assert not exists (select 1 from public.profiles where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'), 'The profile should be deleted with the account';
end $$;

select 'ALL ACCESS CHECKS PASSED' as result;

rollback;
