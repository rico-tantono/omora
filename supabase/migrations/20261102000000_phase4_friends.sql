-- OMORA Phase 4: friendships, friend requests and people search.
--
-- Run once in the Supabase dashboard: SQL Editor > New query > paste this file > Run.
-- Run the Phase 1, 2 and 3 migrations first. Safe to run again: every statement is idempotent.
--
-- What it creates
--   public.friendships   one row per pair of people: a pending request or an accepted connection
--   public.search_profiles   finds people by name or username, without opening up the profiles table
--   RPC functions        the only way to send, answer, cancel and remove connections
--
-- Privacy in this phase: you can see your own friendship rows, and the basic profile (name, picture, bio)
-- of anyone you are connected with or have a request with. Search returns only those same basic fields.
-- Every signed-in user is searchable for now; the profile visibility setting arrives with Phase 5.

begin;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.friendships (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'pending',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,

  primary key (requester_id, addressee_id),
  constraint friendships_not_self check (requester_id <> addressee_id),
  constraint friendships_status_values check (status in ('pending', 'accepted'))
);

-- One friendship per pair, whichever of the two asked first.
create unique index if not exists friendships_pair_key
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create index if not exists friendships_addressee_idx on public.friendships (addressee_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Changes happen only through the functions below, so there are no insert, update or delete rules.
-- ---------------------------------------------------------------------------
alter table public.friendships enable row level security;

revoke all on public.friendships from anon, authenticated;
grant select on public.friendships to authenticated;

drop policy if exists "friendships_select_own" on public.friendships;
create policy "friendships_select_own" on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- True when you are connected with that person or have a request with them, in either direction.
create or replace function public.has_friendship_with(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where (f.requester_id = (select auth.uid()) and f.addressee_id = p_profile_id)
       or (f.addressee_id = (select auth.uid()) and f.requester_id = p_profile_id)
  );
$$;

revoke all on function public.has_friendship_with(uuid) from public, anon;
grant execute on function public.has_friendship_with(uuid) to authenticated;

drop policy if exists "profiles_select_friends" on public.profiles;
create policy "profiles_select_friends" on public.profiles
  for select to authenticated using (public.has_friendship_with(id));

-- ---------------------------------------------------------------------------
-- Functions the app calls
-- ---------------------------------------------------------------------------

-- Returns 'requested', or 'connected' when the other person had already asked you.
create or replace function public.send_friend_request(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_existing public.friendships;
begin
  if v_uid is null or p_user_id is null or p_user_id = v_uid then raise exception 'not_allowed'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then raise exception 'user_not_found'; end if;

  select * into v_existing from public.friendships
    where (requester_id = v_uid and addressee_id = p_user_id)
       or (requester_id = p_user_id and addressee_id = v_uid);

  if found then
    if v_existing.status = 'accepted' then raise exception 'already_friends'; end if;
    if v_existing.requester_id = v_uid then raise exception 'already_requested'; end if;

    update public.friendships
      set status = 'accepted', responded_at = now()
      where requester_id = p_user_id and addressee_id = v_uid;
    return 'connected';
  end if;

  if (select count(*) from public.friendships where requester_id = v_uid and status = 'pending') >= 50 then
    raise exception 'too_many_requests';
  end if;

  insert into public.friendships (requester_id, addressee_id) values (v_uid, p_user_id);
  return 'requested';
end;
$$;

create or replace function public.respond_to_friend_request(p_requester_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if p_accept then
    update public.friendships
      set status = 'accepted', responded_at = now()
      where requester_id = p_requester_id and addressee_id = v_uid and status = 'pending';
  else
    delete from public.friendships
      where requester_id = p_requester_id and addressee_id = v_uid and status = 'pending';
  end if;
  if not found then raise exception 'not_allowed'; end if;
end;
$$;

create or replace function public.cancel_friend_request(p_addressee_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friendships
    where requester_id = (select auth.uid()) and addressee_id = p_addressee_id and status = 'pending';
  if not found then raise exception 'not_allowed'; end if;
end;
$$;

create or replace function public.remove_friend(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  delete from public.friendships
    where status = 'accepted'
      and ((requester_id = v_uid and addressee_id = p_user_id)
        or (requester_id = p_user_id and addressee_id = v_uid));
  if not found then raise exception 'not_allowed'; end if;
end;
$$;

-- People matching a name or username (at least 3 letters), with your relationship to each.
-- Only basic profile fields are returned, and never your own profile.
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
    and (strpos(lower(p.username), q.term) > 0 or strpos(lower(p.display_name), q.term) > 0)
  order by (strpos(lower(p.username), q.term) = 1) desc, p.username
  limit 20;
$$;

revoke all on function
  public.send_friend_request(uuid),
  public.respond_to_friend_request(uuid, boolean),
  public.cancel_friend_request(uuid),
  public.remove_friend(uuid),
  public.search_profiles(text)
  from public, anon;
grant execute on function
  public.send_friend_request(uuid),
  public.respond_to_friend_request(uuid, boolean),
  public.cancel_friend_request(uuid),
  public.remove_friend(uuid),
  public.search_profiles(text)
  to authenticated;

commit;
