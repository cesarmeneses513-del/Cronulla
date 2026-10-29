-- Which projects the team sees, chosen per person like clients (Data → Users → "Projects they see").
-- Run once in Supabase → SQL Editor, after projects.sql (safe to run again).
--
-- • Administrators see every project.
-- • The rest of the team always sees Cronulla (where they work), plus every project if given
--   "All projects", or only the ones chosen for them.
-- • Team accounts that already exist keep seeing every project; new ones start with Cronulla only.

create or replace function public.can_see_project(pid text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.my_role() = 'admin' then true
    when public.my_role() in ('project_manager', 'team_leader', 'technician', 'client') then
      (pid = 'cronulla' and public.my_role() <> 'client')
      or coalesce((select all_projects from public.profiles where id = auth.uid()), false)
      or exists (select 1 from public.project_access where user_id = auth.uid() and project_id = pid)
    else false
  end;
$$;

-- Only the first time this file runs: the team as it is today keeps seeing everything.
-- (Running it again doesn't undo the projects chosen meanwhile.)
create table if not exists public.app_settings (key text primary key, value text not null default '');
alter table public.app_settings enable row level security;
do $$
begin
  if not exists (select 1 from public.app_settings where key = 'staff_projects_set') then
    update public.profiles set all_projects = true where role in ('project_manager', 'team_leader', 'technician');
    insert into public.app_settings (key, value) values ('staff_projects_set', now()::text);
  end if;
end $$;
