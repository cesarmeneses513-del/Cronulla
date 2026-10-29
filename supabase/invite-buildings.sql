-- Invitations carry the buildings the person will see (Data → Users → Invite user).
-- Run once in Supabase → SQL Editor, after projects.sql (safe to run again).
-- When they create their account with that email, they get those buildings straight away.

alter table public.invitations add column if not exists all_projects boolean not null default false;
alter table public.invitations add column if not exists project_ids text[] not null default '{}';

create or replace function public.create_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invitations;
begin
  select * into inv from public.invitations where lower(email) = lower(coalesce(new.email, ''));
  insert into public.profiles (id, email, name, role, job_title, all_projects)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), nullif(inv.name, ''), split_part(coalesce(new.email, ''), '@', 1)),
    case
      when inv.email is not null then inv.role
      when exists (select 1 from public.profiles where role = 'admin') then 'pending'
      else 'admin'
    end,
    coalesce(inv.job_title, ''),
    coalesce(inv.all_projects, false)
  )
  on conflict (id) do nothing;
  if inv.email is not null then
    insert into public.project_access (user_id, project_id)
    select new.id, p.id from public.projects p where p.id = any (inv.project_ids)
    on conflict do nothing;
    delete from public.invitations where email = inv.email;
  end if;
  return new;
end;
$$;
