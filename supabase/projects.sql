-- Several projects (buildings) in one app. Run once in Supabase → SQL Editor (safe to run again).
--
-- • Cronulla stays the only project the team edits; the others are for viewing (clients).
-- • Every defect belongs to a project; the ones already here are Cronulla's.
-- • The team (every role except Client) sees every project. A client sees only the projects an
--   administrator gives them (Data → Users), or all of them if given "All projects".
-- • Nobody reads defects without signing in any more: clients enter with their account.
-- • "Sort and renumber" only numbers Cronulla.
--
-- After running this, paste the new versions of both sheet scripts (google-sheets/sync.gs and
-- glide-to-web.gs): they read only Cronulla's defects.

-- ─────────────── Projects ───────────────
create table if not exists public.projects (
  id          text primary key,
  name        text not null,
  address     text not null default '',
  cover_url   text not null default '',
  -- Only editable projects can be changed (photos, status, measures…): Cronulla.
  editable    boolean not null default false,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

insert into public.projects (id, name, address, editable, position)
values ('cronulla', 'Cronulla', '1 Kingsway, Cronulla NSW 2230', true, 0)
on conflict (id) do nothing;

alter table public.defects add column if not exists project_id text not null default 'cronulla'
  references public.projects (id);
create index if not exists defects_project_position_idx on public.defects (project_id, position);

-- ─────────────── Which projects each client sees ───────────────
create table if not exists public.project_access (
  user_id     uuid not null references auth.users (id) on delete cascade,
  project_id  text not null references public.projects (id) on delete cascade,
  primary key (user_id, project_id)
);
alter table public.profiles add column if not exists all_projects boolean not null default false;

-- Clients that already exist keep seeing Cronulla.
insert into public.project_access (user_id, project_id)
select id, 'cronulla' from public.profiles where role = 'client'
on conflict do nothing;

create or replace function public.can_see_project(pid text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.my_role() in ('admin', 'project_manager', 'team_leader', 'technician') then true
    when public.my_role() = 'client' then
      coalesce((select all_projects from public.profiles where id = auth.uid()), false)
      or exists (select 1 from public.project_access where user_id = auth.uid() and project_id = pid)
    else false
  end;
$$;

create or replace function public.project_editable(pid text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select editable from public.projects where id = pid), false);
$$;

alter table public.projects enable row level security;
drop policy if exists "projects read"  on public.projects;
drop policy if exists "projects admin" on public.projects;
create policy "projects read"  on public.projects for select to authenticated using (public.can_see_project(id));
create policy "projects admin" on public.projects for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.project_access enable row level security;
drop policy if exists "project access read"  on public.project_access;
drop policy if exists "project access admin" on public.project_access;
create policy "project access read"  on public.project_access for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "project access admin" on public.project_access for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ─────────────── Defects: each person sees their projects; only Cronulla can change ───────────────
drop policy if exists "defects read"   on public.defects;
drop policy if exists "defects insert" on public.defects;
drop policy if exists "defects update" on public.defects;
drop policy if exists "defects delete" on public.defects;
create policy "defects read" on public.defects for select to authenticated
  using (public.can_see_project(project_id));
create policy "defects insert" on public.defects for insert to authenticated
  with check (public.has_permission('defects.create') and public.project_editable(project_id));
create policy "defects update" on public.defects for update to authenticated
  using (public.can_change_defects() and public.project_editable(project_id))
  with check (public.can_change_defects() and public.project_editable(project_id));
create policy "defects delete" on public.defects for delete to authenticated
  using (public.has_permission('defects.delete') and public.project_editable(project_id));

-- ─────────────── "Sort and renumber": Cronulla only ───────────────
create or replace function public.renumber_defects()
returns void
language sql
security definer
set search_path = public
as $$
  with keys as (
    select
      id,
      position,
      upper(trim(coalesce(data->>'orientation', ''))) as stage,
      upper(trim(coalesce(data->>'drop', '')))        as drp,
      upper(trim(coalesce(data->>'level', '')))       as lvl
    from public.defects
    where project_id = 'cronulla'
  ),
  ordered as (
    select
      id,
      row_number() over (
        order by
          stage = '',
          regexp_replace(stage, '\d+', '', 'g'),
          (substring(stage from '\d+'))::numeric nulls first,
          drp = '',
          regexp_replace(drp, '\d+', '', 'g'),
          (substring(drp from '\d+'))::numeric nulls first,
          case
            when lvl = '' then 1000000
            when lvl = 'G' then -1
            when lvl = 'R' then 100000
            when lvl ~ '^\d+(\.\d+)?' then (substring(lvl from '^\d+(?:\.\d+)?'))::numeric
            else 50000
          end,
          lvl,
          position,
          id
      ) as n
    from keys
  )
  update public.defects d
  set data = jsonb_set(d.data, '{rowNo}', to_jsonb(o.n::text)),
      client_id = 'renumber',
      updated_at = now()
  from ordered o
  where o.id = d.id
    and d.data->>'rowNo' is distinct from o.n::text;
$$;
