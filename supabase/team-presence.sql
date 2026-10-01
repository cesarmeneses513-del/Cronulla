-- Team view: who is connected. Run once in Supabase → SQL Editor, after roles.sql.
-- Roles with the "Ver técnicos conectados" permission (by default Administrator, Project
-- Manager and Team Leader) see the Facade Technicians in Data → Users, with a green dot when
-- they have the app open and "last seen" otherwise. Administrators already see everyone.

alter table public.profiles add column if not exists last_seen_at timestamptz;

-- The app calls this while it's open, so "last seen" stays current.
create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;
revoke execute on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;

insert into public.role_permissions (role, permission, allowed) values
  ('admin', 'team.view', true),
  ('project_manager', 'team.view', true),
  ('team_leader', 'team.view', true),
  ('technician', 'team.view', false),
  ('client', 'team.view', false)
on conflict (role, permission) do nothing;

drop policy if exists "profiles team read" on public.profiles;
create policy "profiles team read" on public.profiles for select to authenticated
  using (role = 'technician' and public.has_permission('team.view'));
