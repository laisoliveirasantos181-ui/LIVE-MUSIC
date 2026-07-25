-- LIVE MUSIC V3.2 — Player Premium
-- Execute este arquivo uma única vez no SQL Editor do Supabase.

create or replace function public.increment_track_play_count(p_track_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count bigint;
begin
  update public.tracks
  set play_count = coalesce(play_count, 0) + 1,
      updated_at = now()
  where id = p_track_id
    and status = 'published'
  returning play_count into new_count;

  return coalesce(new_count, 0);
end;
$$;

revoke all on function public.increment_track_play_count(uuid) from public;
grant execute on function public.increment_track_play_count(uuid) to authenticated;

-- Garante que favoritos sejam únicos por usuário e música.
create unique index if not exists user_favorites_user_track_unique
on public.user_favorites (user_id, track_id);
