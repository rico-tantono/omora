-- OMORA Phase 2: memories, locations, collections and photo storage.
--
-- Run once in the Supabase dashboard: SQL Editor > New query > paste this file > Run.
-- Run the Phase 1 migration first. Safe to run again: every statement is idempotent.
--
-- What it creates
--   public.memories            a memory with its place (name, area, latitude, longitude)
--   public.memory_photos       photos attached to a memory (the files live in Storage)
--   public.collections         a user's named collections
--   public.collection_memories which memories are in which collection
--   Storage buckets            "avatars" (public) and "memory-photos" (private)
--
-- Privacy in this phase: everything is visible only to its owner. Sharing with friends and groups
-- comes in Phases 3 to 5. The visibility column is stored now so those rules can build on it.

begin;

-- ---------------------------------------------------------------------------
-- Memories
-- ---------------------------------------------------------------------------
create table if not exists public.memories (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  title       text not null,
  story       text not null default '',
  place_name  text not null,
  area        text not null default '',
  lat         double precision not null,
  lng         double precision not null,
  visit_date  date not null,
  tags        text[] not null default '{}',
  visibility  text not null default 'private',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint memories_title_length check (char_length(btrim(title)) between 1 and 80),
  constraint memories_story_length check (char_length(story) <= 400),
  constraint memories_place_name_length check (char_length(btrim(place_name)) between 1 and 120),
  constraint memories_area_length check (char_length(area) <= 120),
  constraint memories_lat_range check (lat between -90 and 90),
  constraint memories_lng_range check (lng between -180 and 180),
  constraint memories_tags_limit check (cardinality(tags) <= 5),
  constraint memories_visibility_values check (visibility in ('private', 'connections', 'public'))
);

create index if not exists memories_owner_visit_date_idx on public.memories (owner_id, visit_date desc);

drop trigger if exists memories_set_updated_at on public.memories;
create trigger memories_set_updated_at
  before update on public.memories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Photos
--
-- storage_path is "<owner id>/<memory id>/<file name>". The check below keeps a row from pointing at
-- someone else's folder, and the Storage policies further down use the same first folder name.
-- ---------------------------------------------------------------------------
create table if not exists public.memory_photos (
  id           uuid primary key default gen_random_uuid(),
  memory_id    uuid not null references public.memories (id) on delete cascade,
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  caption      text,
  position     int not null default 0,
  created_at   timestamptz not null default now(),

  constraint memory_photos_path_matches check (storage_path like owner_id::text || '/' || memory_id::text || '/%'),
  constraint memory_photos_caption_length check (caption is null or char_length(caption) <= 80)
);

create index if not exists memory_photos_memory_idx on public.memory_photos (memory_id, position);

-- ---------------------------------------------------------------------------
-- Collections
-- ---------------------------------------------------------------------------
create table if not exists public.collections (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint collections_name_length check (char_length(btrim(name)) between 1 and 30)
);

create index if not exists collections_owner_idx on public.collections (owner_id, created_at);

drop trigger if exists collections_set_updated_at on public.collections;
create trigger collections_set_updated_at
  before update on public.collections
  for each row execute function public.set_updated_at();

create table if not exists public.collection_memories (
  collection_id uuid not null references public.collections (id) on delete cascade,
  memory_id     uuid not null references public.memories (id) on delete cascade,
  added_at      timestamptz not null default now(),
  primary key (collection_id, memory_id)
);

-- ---------------------------------------------------------------------------
-- Row Level Security: owners only
-- ---------------------------------------------------------------------------
alter table public.memories enable row level security;
alter table public.memory_photos enable row level security;
alter table public.collections enable row level security;
alter table public.collection_memories enable row level security;

revoke all on public.memories, public.memory_photos, public.collections, public.collection_memories
  from anon, authenticated;

grant select, delete on public.memories to authenticated;
grant insert (owner_id, title, story, place_name, area, lat, lng, visit_date, tags, visibility)
  on public.memories to authenticated;
grant update (title, story, place_name, area, lat, lng, visit_date, tags, visibility)
  on public.memories to authenticated;

grant select, delete on public.memory_photos to authenticated;
grant insert (memory_id, owner_id, storage_path, caption, position) on public.memory_photos to authenticated;
grant update (caption, position) on public.memory_photos to authenticated;

grant select, delete on public.collections to authenticated;
grant insert (owner_id, name) on public.collections to authenticated;
grant update (name) on public.collections to authenticated;

grant select, insert, delete on public.collection_memories to authenticated;

-- memories
drop policy if exists "memories_select_own" on public.memories;
create policy "memories_select_own" on public.memories
  for select to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists "memories_insert_own" on public.memories;
create policy "memories_insert_own" on public.memories
  for insert to authenticated with check ((select auth.uid()) = owner_id);

drop policy if exists "memories_update_own" on public.memories;
create policy "memories_update_own" on public.memories
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "memories_delete_own" on public.memories;
create policy "memories_delete_own" on public.memories
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- memory_photos: a photo can only be added to one of your own memories
drop policy if exists "memory_photos_select_own" on public.memory_photos;
create policy "memory_photos_select_own" on public.memory_photos
  for select to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists "memory_photos_insert_own" on public.memory_photos;
create policy "memory_photos_insert_own" on public.memory_photos
  for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and exists (select 1 from public.memories m where m.id = memory_id and m.owner_id = (select auth.uid()))
  );

drop policy if exists "memory_photos_update_own" on public.memory_photos;
create policy "memory_photos_update_own" on public.memory_photos
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "memory_photos_delete_own" on public.memory_photos;
create policy "memory_photos_delete_own" on public.memory_photos
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- collections
drop policy if exists "collections_select_own" on public.collections;
create policy "collections_select_own" on public.collections
  for select to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists "collections_insert_own" on public.collections;
create policy "collections_insert_own" on public.collections
  for insert to authenticated with check ((select auth.uid()) = owner_id);

drop policy if exists "collections_update_own" on public.collections;
create policy "collections_update_own" on public.collections
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "collections_delete_own" on public.collections;
create policy "collections_delete_own" on public.collections
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- collection_memories: both the collection and the memory must be yours
drop policy if exists "collection_memories_select_own" on public.collection_memories;
create policy "collection_memories_select_own" on public.collection_memories
  for select to authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = (select auth.uid())));

drop policy if exists "collection_memories_insert_own" on public.collection_memories;
create policy "collection_memories_insert_own" on public.collection_memories
  for insert to authenticated
  with check (
    exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = (select auth.uid()))
    and exists (select 1 from public.memories m where m.id = memory_id and m.owner_id = (select auth.uid()))
  );

drop policy if exists "collection_memories_delete_own" on public.collection_memories;
create policy "collection_memories_delete_own" on public.collection_memories
  for delete to authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Storage
--
-- avatars       public: profile pictures are shown to other people later, so they are readable by URL.
--               Files are still only writable inside your own folder.
-- memory-photos private: readable only by the owner, through short-lived signed links.
-- The app resizes and re-encodes every image to JPEG before upload, which also strips location metadata.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('memory-photos', 'memory-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "memory_photos_storage_select_own" on storage.objects;
create policy "memory_photos_storage_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'memory-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "memory_photos_storage_insert_own" on storage.objects;
create policy "memory_photos_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'memory-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "memory_photos_storage_delete_own" on storage.objects;
create policy "memory_photos_storage_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'memory-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
