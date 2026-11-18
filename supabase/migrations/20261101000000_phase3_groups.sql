-- OMORA Phase 3: groups and group members.
--
-- Run once in the Supabase dashboard: SQL Editor > New query > paste this file > Run.
-- Run the Phase 1 and Phase 2 migrations first. Safe to run again: every statement is idempotent.
--
-- What it creates
--   public.groups          a persistent group: name, description, picture, owner
--   public.group_members   who is in a group, and who has been invited but has not answered yet
--   helper functions       used by the access rules below
--   RPC functions          the only way to create groups and change membership
--
-- Privacy in this phase: only people in a group can see it. Members can see each other's basic profile.
-- Someone you invite can see the group and its members, but not the other pending invitations.
-- Sharing memories with a group comes in Phase 5.

begin;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  name        text not null,
  description text not null default '',
  avatar_key  text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint groups_name_length check (char_length(btrim(name)) between 1 and 32),
  constraint groups_description_length check (char_length(description) <= 90),
  constraint groups_avatar_key_values check (avatar_key is null or avatar_key in ('ember', 'moss', 'rose', 'dusk')),
  constraint groups_avatar_url_length check (avatar_url is null or char_length(avatar_url) <= 2048)
);

drop trigger if exists groups_set_updated_at on public.groups;
create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();

create table if not exists public.group_members (
  group_id   uuid not null references public.groups (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       text not null default 'member',
  status     text not null default 'invited',
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  joined_at  timestamptz,

  primary key (group_id, user_id),
  constraint group_members_role_values check (role in ('owner', 'member')),
  constraint group_members_status_values check (status in ('invited', 'member'))
);

create index if not exists group_members_user_idx on public.group_members (user_id);

-- ---------------------------------------------------------------------------
-- Helper functions for the access rules
--
-- A rule on group_members that reads group_members would call itself forever.
-- These functions read the table with the owner's rights, so the rules stay simple.
-- ---------------------------------------------------------------------------
create or replace function public.is_group_participant(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = (select auth.uid()) and status = 'member'
  );
$$;

-- True when you and that person are in a group together, so you may see their basic profile.
-- Members see invited people; invited people see only the members.
create or replace function public.shares_group_with(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members theirs
    join public.group_members mine on mine.group_id = theirs.group_id
    where theirs.user_id = p_profile_id
      and mine.user_id = (select auth.uid())
      and (theirs.status = 'member' or mine.status = 'member')
  );
$$;

revoke all on function public.is_group_participant(uuid), public.is_group_member(uuid), public.shares_group_with(uuid)
  from public, anon;
grant execute on function public.is_group_participant(uuid), public.is_group_member(uuid), public.shares_group_with(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Creating a group and changing membership happen only through the functions further down,
-- so there are no insert, update or delete rules on group_members.
-- ---------------------------------------------------------------------------
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

revoke all on public.groups, public.group_members from anon, authenticated;
grant select, delete on public.groups to authenticated;
grant update (name, description, avatar_key, avatar_url) on public.groups to authenticated;
grant select on public.group_members to authenticated;

drop policy if exists "groups_select_participants" on public.groups;
create policy "groups_select_participants" on public.groups
  for select to authenticated using (public.is_group_participant(id));

drop policy if exists "groups_update_owner" on public.groups;
create policy "groups_update_owner" on public.groups
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "groups_delete_owner" on public.groups;
create policy "groups_delete_owner" on public.groups
  for delete to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists "group_members_select_visible" on public.group_members;
create policy "group_members_select_visible" on public.group_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_group_member(group_id)
    or (status = 'member' and public.is_group_participant(group_id))
  );

-- People in a group with you can read each other's basic profile (name, picture, bio).
drop policy if exists "profiles_select_group_mates" on public.profiles;
create policy "profiles_select_group_mates" on public.profiles
  for select to authenticated using (public.shares_group_with(id));

-- ---------------------------------------------------------------------------
-- Functions the app calls
--
-- Each one checks who is calling. Error names (not_allowed, user_not_found, ...) are matched by the app.
-- ---------------------------------------------------------------------------
create or replace function public.create_group(
  p_name text,
  p_description text default '',
  p_avatar_key text default null,
  p_avatar_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id  uuid;
begin
  if v_uid is null then raise exception 'not_allowed'; end if;

  insert into public.groups (owner_id, name, description, avatar_key, avatar_url)
  values (v_uid, p_name, coalesce(p_description, ''), p_avatar_key, p_avatar_url)
  returning id into v_id;

  insert into public.group_members (group_id, user_id, role, status, joined_at)
  values (v_id, v_uid, 'owner', 'member', now());

  return v_id;
end;
$$;

create or replace function public.invite_to_group(p_group_id uuid, p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_target uuid;
begin
  if not exists (select 1 from public.groups where id = p_group_id and owner_id = v_uid) then
    raise exception 'not_allowed';
  end if;

  select id into v_target from public.profiles where lower(username) = lower(btrim(p_username));
  if v_target is null then raise exception 'user_not_found'; end if;

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

create or replace function public.respond_to_invite(p_group_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if p_accept then
    update public.group_members
      set status = 'member', joined_at = now()
      where group_id = p_group_id and user_id = v_uid and status = 'invited';
  else
    delete from public.group_members
      where group_id = p_group_id and user_id = v_uid and status = 'invited';
  end if;
  if not found then raise exception 'not_allowed'; end if;
end;
$$;

-- The owner cannot leave; they delete the group instead.
create or replace function public.leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.group_members
    where group_id = p_group_id and user_id = (select auth.uid()) and role <> 'owner' and status = 'member';
  if not found then raise exception 'not_allowed'; end if;
end;
$$;

-- Removes a member, or cancels a pending invitation.
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
end;
$$;

revoke all on function
  public.create_group(text, text, text, text),
  public.invite_to_group(uuid, text),
  public.respond_to_invite(uuid, boolean),
  public.leave_group(uuid),
  public.remove_group_member(uuid, uuid)
  from public, anon;
grant execute on function
  public.create_group(text, text, text, text),
  public.invite_to_group(uuid, text),
  public.respond_to_invite(uuid, boolean),
  public.leave_group(uuid),
  public.remove_group_member(uuid, uuid)
  to authenticated;

commit;
