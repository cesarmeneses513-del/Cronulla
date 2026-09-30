-- Roles, job titles, invitations and permissions. Run once in Supabase → SQL Editor, after
-- accounts.sql. Existing accounts are kept: "user" becomes Facade Technician, "disabled" becomes
-- inactive.
--
-- Roles: admin (Administrador), project_manager, team_leader (Team Leader / Supervisor),
-- technician (Facade Technician, editor), client; "pending" = signed up without an invitation,
-- waiting for an administrator.

-- ─────────────── Profiles: new roles, job title, active ───────────────
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add column if not exists job_title text not null default '';
alter table public.profiles add column if not exists active boolean not null default true;

update public.profiles set active = false, role = 'technician' where role = 'disabled';
update public.profiles set role = 'technician' where role = 'user';

alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'project_manager', 'team_leader', 'technician', 'client', 'pending'));

-- Role of the signed-in person, '' when not signed in or inactive.
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid() and active), '');
$$;

-- ─────────────── Permissions: what each role may do ───────────────
create table if not exists public.role_permissions (
  role        text not null,
  permission  text not null,
  allowed     boolean not null default false,
  primary key (role, permission)
);

-- Defaults (only added where missing, so changes made in the web are kept if this runs again).
insert into public.role_permissions (role, permission, allowed)
select r.role, p.permission, p.permission = any(r.perms)
from (values
  ('admin',           array['defects.create','defects.edit','photos.add','photos.move','photos.delete','defects.delete','history.view','csv.import','csv.export','renumber','users.manage']),
  ('project_manager', array['defects.create','defects.edit','photos.add','photos.move','photos.delete','defects.delete','history.view','csv.export','renumber']),
  ('team_leader',     array['defects.create','defects.edit','photos.add','photos.move','photos.delete','history.view','csv.export']),
  ('technician',      array['defects.create','defects.edit','photos.add','history.view']),
  ('client',          array['csv.export'])
) as r(role, perms)
cross join (values
  ('defects.create'),('defects.edit'),('photos.add'),('photos.move'),('photos.delete'),('defects.delete'),
  ('history.view'),('csv.import'),('csv.export'),('renumber'),('users.manage')
) as p(permission)
on conflict (role, permission) do nothing;

create or replace function public.has_permission(p text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.my_role() = 'admin'
      or exists (select 1 from public.role_permissions where role = public.my_role() and permission = p and allowed);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.my_role() = 'admin' or public.has_permission('users.manage');
$$;

alter table public.role_permissions enable row level security;
drop policy if exists "permissions read"  on public.role_permissions;
drop policy if exists "permissions write" on public.role_permissions;
create policy "permissions read"  on public.role_permissions for select to anon, authenticated using (true);
create policy "permissions write" on public.role_permissions for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ─────────────── Invitations ───────────────
-- An administrator invites someone by email with a role and job title; when that person creates
-- their account with that email, they get them straight away.
create table if not exists public.invitations (
  email       text primary key,
  name        text not null default '',
  role        text not null default 'technician' check (role in ('admin', 'project_manager', 'team_leader', 'technician', 'client')),
  job_title   text not null default '',
  invited_by  text not null default '',
  created_at  timestamptz not null default now()
);

alter table public.invitations enable row level security;
drop policy if exists "invitations admin" on public.invitations;
create policy "invitations admin" on public.invitations for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- New account: its invitation if there is one; otherwise the first account is the administrator
-- and the rest wait as pending.
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
  insert into public.profiles (id, email, name, role, job_title)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), nullif(inv.name, ''), split_part(coalesce(new.email, ''), '@', 1)),
    case
      when inv.email is not null then inv.role
      when exists (select 1 from public.profiles where role = 'admin') then 'pending'
      else 'admin'
    end,
    coalesce(inv.job_title, '')
  )
  on conflict (id) do nothing;
  if inv.email is not null then
    delete from public.invitations where email = inv.email;
  end if;
  return new;
end;
$$;

-- ─────────────── Delete an account for good (administrators) ───────────────
create or replace function public.delete_account(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can delete accounts';
  end if;
  if target = auth.uid() then
    raise exception 'You cannot delete your own account';
  end if;
  delete from auth.users where id = target; -- the profile goes with it
end;
$$;
revoke execute on function public.delete_account(uuid) from public, anon;
grant execute on function public.delete_account(uuid) to authenticated;
