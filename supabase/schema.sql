-- Run once in Supabase → SQL Editor.

-- Defect rows. The full DefectItem is stored as JSON; `position` keeps the list order.
create table if not exists public.defects (
  id          text primary key,
  position    integer not null default 0,
  data        jsonb   not null,
  client_id   text,            -- browser session that wrote the row (to ignore realtime echoes)
  updated_at  timestamptz not null default now()
);

create index if not exists defects_position_idx on public.defects (position);

-- The app has no login yet, so the publishable (anon) key gets full access.
-- Anyone with the app URL can read and edit. Tighten these policies once auth is added.
alter table public.defects enable row level security;

drop policy if exists "defects anon read"   on public.defects;
drop policy if exists "defects anon write"  on public.defects;
create policy "defects anon read"  on public.defects for select to anon, authenticated using (true);
create policy "defects anon write" on public.defects for all    to anon, authenticated using (true) with check (true);

-- Live updates between devices.
do $$
begin
  alter publication supabase_realtime add table public.defects;
exception when duplicate_object then null;
end $$;

-- Public bucket for uploaded inspection photos.
insert into storage.buckets (id, name, public)
values ('inspection-photos', 'inspection-photos', true)
on conflict (id) do nothing;

drop policy if exists "inspection photos read"   on storage.objects;
drop policy if exists "inspection photos upload" on storage.objects;
create policy "inspection photos read"   on storage.objects for select to anon, authenticated
  using (bucket_id = 'inspection-photos');
create policy "inspection photos upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'inspection-photos');
