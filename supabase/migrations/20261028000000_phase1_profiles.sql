-- OMORA Phase 1: user profiles linked to Supabase Auth.
--
-- Run once in the Supabase dashboard: SQL Editor > New query > paste this file > Run.
-- Safe to run again: every statement is idempotent.
--
-- What it creates
--   public.profiles               one row per auth user
--   public.set_updated_at()       keeps updated_at current
--   public.handle_new_user()      trigger function that creates the profile at signup
--   public.is_username_available  lets the signup form check a username before the account exists

begin;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text not null,
  display_name text not null,
  bio          text not null default '',
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Mirrors the rules in the app's form validation.
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9._]{3,20}$'),
  constraint profiles_display_name_length check (char_length(btrim(display_name)) between 1 and 30),
  constraint profiles_bio_length check (char_length(bio) <= 140),
  constraint profiles_avatar_url_length check (avatar_url is null or char_length(avatar_url) <= 2048)
);

-- Usernames are unique regardless of letter case ("Nadia" and "nadia" collide).
create unique index if not exists profiles_username_lower_key on public.profiles (lower(username));

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Phase 1 only needs each user to read and edit their own profile, so that is
-- all that is allowed. Phase 4 (friends) will add the read access it needs.
-- There is no delete policy: a profile is removed only when its auth user is.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Column-level privileges: users can never change id or created_at, whatever the policies say.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, username, display_name, bio, avatar_url) on public.profiles to authenticated;
grant update (username, display_name, bio, avatar_url) on public.profiles to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

-- Insert is the app's fallback when the signup trigger did not create the row.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- Create the profile when a user signs up
--
-- SECURITY DEFINER lets the trigger insert even though the new user has no
-- session yet. search_path is pinned so the function cannot be hijacked.
-- Registration must never fail because of the profile: a taken username gets a
-- numeric suffix, and any other problem is logged as a warning. In that case
-- the app creates the profile on first sign-in.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_username text;
  candidate     text;
  attempt       int := 0;
begin
  base_username := left(
    regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '[^A-Za-z0-9._]', '', 'g'),
    20
  );
  if char_length(base_username) < 3 then
    base_username := 'user' || left(replace(new.id::text, '-', ''), 8);
  end if;
  candidate := base_username;

  loop
    begin
      insert into public.profiles (id, username, display_name)
      values (new.id, candidate, candidate);
      return new;
    exception when unique_violation then
      attempt := attempt + 1;
      exit when attempt > 5;
      candidate := left(base_username, 15) || '_' || lpad(floor(random() * 10000)::int::text, 4, '0');
    end;
  end loop;

  return new;
exception when others then
  raise warning 'handle_new_user: no profile created for %: %', new.id, sqlerrm;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Username availability check for the signup form
--
-- Returns only true or false. It is callable before signing in, which means
-- anyone can test whether a username exists; that is the usual tradeoff for
-- telling people early that a name is taken.
-- ---------------------------------------------------------------------------
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(btrim(p_username))
  );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

commit;
