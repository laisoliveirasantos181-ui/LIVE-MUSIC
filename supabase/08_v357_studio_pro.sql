-- LIVE MUSIC V3.5.7 Studio Pro
-- Execute once in Supabase SQL Editor.
alter table public.profiles add column if not exists is_active boolean not null default true;

-- Realtime dashboard: add tables to publication when not already present.
do $$
begin
  begin alter publication supabase_realtime add table public.tracks; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.artists; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.albums; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.genres; exception when duplicate_object then null; end;
end $$;
