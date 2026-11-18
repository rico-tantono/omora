-- OMORA Phase 6: hardening and account deletion.
--
-- Run once in the Supabase dashboard: SQL Editor > New query > paste this file > Run.
-- Run the Phase 1 to 5 migrations first. Safe to run again: every statement is idempotent.
--
-- What it does
--   limits tag length, photos per memory and open group invitations (abuse limits)
--   lets you list your own profile pictures (needed to clean up when deleting an account)
--   adds delete_my_account(), which removes your account and everything that belongs to it
--   makes sure signed-out visitors have no access to any table, now or for tables added later

begin;

-- ---------------------------------------------------------------------------
-- Limits
-- ---------------------------------------------------------------------------
alter table public.memories drop constraint if exists memories_tags_length;
alter table public.memories add constraint memories_tags_length
  check (char_length(array_to_string(tags, ',')) <= 200);

-- At most 6 photos on a memory. Runs as the person adding the photo, who can see their own rows.
create or replace function public.limit_memory_photos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.memory_photos where memory_id = new.memory_id) >= 6 then
    raise exception 'too_many_photos';
  end if;
  return new;
end;
$$;

drop trigger if exists memory_photos_limit on public.memory_photos;
create trigger memory_photos_limit
  before insert on public.memory_photos
  for each row execute function public.limit_memory_photos();

-- The Phase 5 invitation function, plus a cap on how many open invitations one person can have sent.
create or replace function public.invite_to_group(p_group_id uuid, p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_target uuid;
  v_vis    text;
begin
  if not exists (select 1 from public.groups where id = p_group_id and owner_id = v_uid) then
    raise exception 'not_allowed';
  end if;

  select id, visibility into v_target, v_vis from public.profiles where lower(username) = lower(btrim(p_username));
  if v_target is null or (v_vis = 'private' and not public.are_friends(v_target)) then
    raise exception 'user_not_found';
  end if;

  if exists (select 1 from public.group_members where group_id = p_group_id and user_id = v_target) then
    raise exception 'already_in_group';
  end if;

  if (select count(*) from public.group_members where group_id = p_group_id) >= 50 then
    raise exception 'group_full';
  end if;

  if (select count(*) from public.group_members where invited_by = v_uid and status = 'invited') >= 50 then
    raise exception 'too_many_invites';
  end if;

  insert into public.group_members (group_id, user_id, role, status, invited_by)
  values (p_group_id, v_target, 'member', 'invited', v_uid);
end;
$$;

-- ---------------------------------------------------------------------------
-- Profile pictures: you can list the files in your own folder (used when deleting an account)
-- ---------------------------------------------------------------------------
drop policy if exists "avatars_select_own" on storage.objects;
create policy "avatars_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Account deletion
--
-- Deleting the auth user removes the profile, and through it your memories, photo records, collections,
-- connections, group memberships and the groups you own. Memories other people added to a group you owned
-- go back to being private memories of their authors. The app deletes your uploaded files from Storage.
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'not_allowed'; end if;
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- Signed-out visitors get nothing from the tables
--
-- Every table already has its own grants. This also covers tables added later, so a new table is never
-- readable until someone grants it on purpose.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon, authenticated;

commit;
