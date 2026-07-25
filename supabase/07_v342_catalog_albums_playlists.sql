-- LIVE MUSIC V3.4.2 — Catálogo sincronizado, álbuns e playlists
-- Execute uma única vez no SQL Editor do Supabase.

-- Garante as tabelas necessárias, inclusive em projetos que não executaram toda a migração V3.0.1.
create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  title text not null,
  slug text,
  description text,
  cover_path text,
  is_public boolean not null default false,
  is_editorial boolean not null default false,
  is_featured boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_editorial or owner_id is null)
);

create table if not exists public.playlist_tracks (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  position integer not null check (position > 0),
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (playlist_id, track_id),
  unique (playlist_id, position)
);

create index if not exists playlists_owner_idx on public.playlists(owner_id);
create index if not exists playlist_tracks_order_idx on public.playlist_tracks(playlist_id, position);

alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;

drop policy if exists "playlists_read_visible" on public.playlists;
create policy "playlists_read_visible" on public.playlists
for select to authenticated
using (is_public or owner_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "playlists_user_insert" on public.playlists;
create policy "playlists_user_insert" on public.playlists
for insert to authenticated
with check ((owner_id = (select auth.uid()) and not is_editorial) or (select private.is_admin()));

drop policy if exists "playlists_user_update" on public.playlists;
create policy "playlists_user_update" on public.playlists
for update to authenticated
using (owner_id = (select auth.uid()) or (select private.is_admin()))
with check ((owner_id = (select auth.uid()) and not is_editorial) or (select private.is_admin()));

drop policy if exists "playlists_user_delete" on public.playlists;
create policy "playlists_user_delete" on public.playlists
for delete to authenticated
using (owner_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "playlist_tracks_read_visible" on public.playlist_tracks;
create policy "playlist_tracks_read_visible" on public.playlist_tracks
for select to authenticated
using (exists (
  select 1 from public.playlists p
  where p.id = playlist_id
    and (p.is_public or p.owner_id = (select auth.uid()) or (select private.is_admin()))
));

drop policy if exists "playlist_tracks_manage_owner" on public.playlist_tracks;
create policy "playlist_tracks_manage_owner" on public.playlist_tracks
for all to authenticated
using (exists (
  select 1 from public.playlists p
  where p.id = playlist_id
    and (p.owner_id = (select auth.uid()) or (select private.is_admin()))
))
with check (exists (
  select 1 from public.playlists p
  where p.id = playlist_id
    and (p.owner_id = (select auth.uid()) or (select private.is_admin()))
));

-- Habilita eventos Realtime. O bloco ignora tabelas que já estejam na publicação.
do $$
begin
  begin alter publication supabase_realtime add table public.tracks; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.playlists; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.playlist_tracks; exception when duplicate_object then null; end;
end $$;
