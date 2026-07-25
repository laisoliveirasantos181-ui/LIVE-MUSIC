-- LIVE MUSIC V3.3 — Gestão de gêneros
-- Garante que usuários autenticados possam ler gêneros e que somente administradores possam gerenciá-los.

create schema if not exists private;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and account_status = 'active'
  );
$$;

revoke all on function private.is_admin() from public;
revoke all on function private.is_admin() from anon;
grant execute on function private.is_admin() to authenticated;

alter table public.genres enable row level security;

drop policy if exists "genres_read_authenticated" on public.genres;
drop policy if exists "genres_admin_all" on public.genres;

create policy "genres_read_authenticated"
on public.genres
for select
to authenticated
using (true);

create policy "genres_admin_all"
on public.genres
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));
