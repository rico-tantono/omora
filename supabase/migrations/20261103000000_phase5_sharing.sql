-- OMORA Phase 5: sharing memories, privacy rules and profile visibility.
--
-- Run once in the Supabase dashboard: SQL Editor > New query > paste this file > Run.
-- Run the Phase 1 to 4 migrations first. Safe to run again: every statement is idempotent.
--
-- Who can see a memory
--   its author, always
--   members of the group it is shared with (a group memory)
--   the author's connections, when its visibility is "connections" and it is not in a group
-- Photos follow the memory: whoever can see the memory can see its photos.
--
-- Who can find a profile in search (the profile visibility setting)
--   public       found by name or username
--   connections  found only by typing the exact username
--   private      not found by anyone who is not already connected; cannot be invited to groups by username

begin;

-- ---------------------------------------------------------------------------
-- Profile visibility
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists visibility text not null default 'public';

alter table public.profiles drop constraint if exists profiles_visibility_values;
alter table public.profiles add constraint profiles_visibility_values
  check (visibility in ('public', 'connections', 'private'));

grant update (visibility) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Memories can belong to a group
--
-- Group memories are stored with visibility "private". If the group is deleted, or the author
-- leaves it, the memory goes back to being a private memory of its author.
-- ---------------------------------------------------------------------------
alter table public.memories add column if not exists group_id uuid references public.groups (id) on delete set null;

create index if not exists memories_group_idx on public.memories (group_id) where group_id is not null;

-- The app only offers "private" and "connections".
update public.memories set visibility = 'private' where visibility = 'public';
alter table public.memories drop constraint if exists memories_visibility_values;
alter table public.memories add constraint memories_visibility_values check (visibility in ('private', 'connections'));

grant insert (group_id) on public.memories to authenticated;
grant update (group_id) on public.memories to authenticated;

-- ---------------------------------------------------------------------------
-- Helper: are you connected with this person?
-- ---------------------------------------------------------------------------
create or replace function public.are_friends(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = (select auth.uid()) and f.addressee_id = p_user_id)
        or (f.addressee_id = (select auth.uid()) and f.requester_id = p_user_id))
  );
$$;

revoke all on function public.are_friends(uuid) from public, anon;
grant execute on function public.are_friends(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Memory access rules
-- ---------------------------------------------------------------------------
drop policy if exists "memories_select_own" on public.memories;
drop policy if exists "memories_select_visible" on public.memories;
create policy "memories_select_visible" on public.memories
  for select to authenticated
  using (
    (select auth.uid()) = owner_id
    or public.is_group_member(group_id)
    or (group_id is null and visibility = 'connections' and public.are_friends(owner_id))
  );

-- You can only put a memory in a group you belong to, and group memories stay "private" as a base.
drop policy if exists "memories_insert_own" on public.memories;
create policy "memories_insert_own" on public.memories
  for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and (group_id is null or (visibility = 'private' and public.is_group_member(group_id)))
  );

drop policy if exists "memories_update_own" on public.memories;
create policy "memories_update_own" on public.memories
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and (group_id is null or (visibility = 'private' and public.is_group_member(group_id)))
  );

-- Photos are visible whenever their memory is (the memory rules above apply inside this check).
drop policy if exists "memory_photos_select_own" on public.memory_photos;
drop policy if exists "memory_photos_select_visible" on public.memory_photos;
create policy "memory_photos_select_visible" on public.memory_photos
  for select to authenticated
  using (exists (select 1 from public.memories m where m.id = memory_photos.memory_id));

-- Storage: the owner's folder, or any file that belongs to a photo you are allowed to see.
drop policy if exists "memory_photos_storage_select_own" on storage.objects;
drop policy if exists "memory_photos_storage_select_visible" on storage.objects;
create policy "memory_photos_storage_select_visible" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'memory-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.memory_photos p where p.storage_path = name)
    )
  );

-- ---------------------------------------------------------------------------
-- Leaving or being removed from a group takes your memories out of it
-- (the Phase 3 functions, with that one addition).
-- ---------------------------------------------------------------------------
create or replace function public.leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  delete from public.group_members
    where group_id = p_group_id and user_id = v_uid and role <> 'owner' and status = 'member';
  if not found then raise exception 'not_allowed'; end if;

  update public.memories set group_id = null, visibility = 'private'
    where group_id = p_group_id and owner_id = v_uid;
end;
$$;

create or replace function public.remove_group_member(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if p_user_id = v_uid
     or not exists (select 1 from public.groups where id = p_group_id and owner_id = v_uid) then
    raise exception 'not_allowed';
  end if;

  delete from public.group_members where group_id = p_group_id and user_id = p_user_id;
  if not found then raise exception 'not_allowed'; end if;

  update public.memories set group_id = null, visibility = 'private'
    where group_id = p_group_id and owner_id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Inviting by username respects profile visibility (the Phase 3 function, plus one rule)
-- ---------------------------------------------------------------------------
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

  insert into public.group_members (group_id, user_id, role, status, invited_by)
  values (p_group_id, v_target, 'member', 'invited', v_uid);
end;
$$;

-- ---------------------------------------------------------------------------
-- Search respects profile visibility (the Phase 4 function, plus one rule)
--
-- Public profiles match by name or username. Others match only on the exact username,
-- unless "private", which is found only by people already connected or with a request.
-- ---------------------------------------------------------------------------
create or replace function public.search_profiles(p_query text)
returns table (id uuid, username text, display_name text, bio text, avatar_url text, relationship text)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (select lower(btrim(coalesce(p_query, ''))) as term)
  select
    p.id,
    p.username,
    p.display_name,
    p.bio,
    p.avatar_url,
    case
      when f.status = 'accepted' then 'connected'
      when f.requester_id = (select auth.uid()) then 'requested'
      when f.requester_id is not null then 'incoming'
      else 'none'
    end as relationship
  from public.profiles p
  cross join q
  left join public.friendships f
    on (f.requester_id = p.id and f.addressee_id = (select auth.uid()))
    or (f.addressee_id = p.id and f.requester_id = (select auth.uid()))
  where char_length(q.term) >= 3
    and p.id <> (select auth.uid())
    and (
      f.requester_id is not null
      or (p.visibility = 'public' and (strpos(lower(p.username), q.term) > 0 or strpos(lower(p.display_name), q.term) > 0))
      or (p.visibility = 'connections' and lower(p.username) = q.term)
    )
    and (strpos(lower(p.username), q.term) > 0 or strpos(lower(p.display_name), q.term) > 0)
  order by (strpos(lower(p.username), q.term) = 1) desc, p.username
  limit 20;
$$;

commit;
