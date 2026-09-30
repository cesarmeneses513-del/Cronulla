-- User accounts (phase 1 of 3). Run once in Supabase → SQL Editor.
--
-- Everyone creates their own account in the web (name, email, password). New accounts wait
-- as "pending" until an administrator gives them a level in Data → Users:
--   admin    everything, including deleting and managing users
--   user     everything except deleting (the old PIN 1111)
--   pending  can't edit yet (sees the gallery like a client)
--   disabled access removed
-- The FIRST account created becomes administrator: create yours right after running this.
--
-- This phase only adds the accounts; the database stays open as before (and the PINs keep
-- working) until everyone has an account. Phase 3 (accounts-lockdown.sql) closes it.

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null default '',
  name        text not null default '',
  role        text not null default 'pending' check (role in ('admin', 'user', 'pending', 'disabled')),
  created_at  timestamptz not null default now()
);

-- Level of the signed-in person ('' when not signed in).
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), '');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.my_role() = 'admin';
$$;

-- A new account gets its profile; the first one ever is the administrator.
create or replace function public.create_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    case when exists (select 1 from public.profiles where role = 'admin') then 'pending' else 'admin' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile();

-- Each person sees their own profile; administrators see and change everyone's.
alter table public.profiles enable row level security;
drop policy if exists "profiles read"   on public.profiles;
drop policy if exists "profiles update" on public.profiles;
create policy "profiles read"   on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles update" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
