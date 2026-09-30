-- Defect types catalogue ("Manage types" in the Edit defect form). Run once in Supabase → SQL
-- Editor, after roles.sql.
--   measures: what each type needs — any of 'area' (Width × Height), 'linear' (Linear metres),
--             'quantity' (Quantity). With more than one, any of them is enough.
--   hidden:   left out of the pickers; defects that already have it keep it.
-- Who can manage it: the "Gestionar tipos de defecto" permission (Data → Users → Permissions).

create table if not exists public.defect_types (
  name        text primary key,
  measures    text[] not null default array['area'],
  hidden      boolean not null default false,
  created_at  timestamptz not null default now()
);

insert into public.defect_types (name, measures) values
  ('RENDER REPAIR', array['area']),
  ('RESEALING WORKS', array['linear']),
  ('SKIM RENDERING', array['area']),
  ('SEAL WINDOW FRAME', array['linear']),
  ('RENDER REPAIR TO SLAB EDGE', array['area']),
  ('RUST SPOT', array['quantity']),
  ('RUST PIPE', array['quantity']),
  ('CONCRETE SPALLING', array['area']),
  ('DILAPIDATION', array['area', 'linear', 'quantity'])
on conflict (name) do nothing;

insert into public.role_permissions (role, permission, allowed) values
  ('admin', 'types.manage', true),
  ('project_manager', 'types.manage', true),
  ('team_leader', 'types.manage', false),
  ('technician', 'types.manage', false),
  ('client', 'types.manage', false)
on conflict (role, permission) do nothing;

alter table public.defect_types enable row level security;
drop policy if exists "defect types read"  on public.defect_types;
drop policy if exists "defect types write" on public.defect_types;
create policy "defect types read"  on public.defect_types for select to anon, authenticated using (true);
create policy "defect types write" on public.defect_types for all to authenticated
  using (public.has_permission('types.manage')) with check (public.has_permission('types.manage'));
