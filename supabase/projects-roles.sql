-- Who sees which buildings, by role. Run once in Supabase → SQL Editor, after projects-staff.sql
-- (safe to run again).
--
-- • Administrators: every building, always.
-- • Project Managers, Team Leaders, Facade Technicians and Clients: only the buildings given to
--   them (Data → Users → Buildings), or all of them if given "All buildings". Cronulla is no
--   longer automatic for them.
--
-- Nobody loses what they see today: Project Managers, Team Leaders and Technicians who saw
-- Cronulla only because it was automatic get it given explicitly.

insert into public.project_access (user_id, project_id)
select id, 'cronulla' from public.profiles
where role in ('project_manager', 'team_leader', 'technician') and not all_projects
on conflict do nothing;

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
      coalesce((select all_projects from public.profiles where id = auth.uid()), false)
      or exists (select 1 from public.project_access where user_id = auth.uid() and project_id = pid)
    else false
  end;
$$;
