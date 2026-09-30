-- "Enviar invitaciones" permission. Run once in Supabase → SQL Editor, after roles.sql.
-- Roles with it can invite people as Facade Technician or Client; roles, accounts and
-- permissions stay with the administrators ("Gestionar usuarios y permisos").

-- Defaults: Administrator, Project Manager and Team Leader can invite.
insert into public.role_permissions (role, permission, allowed)
values
  ('admin', 'users.invite', true),
  ('project_manager', 'users.invite', true),
  ('team_leader', 'users.invite', true),
  ('technician', 'users.invite', false),
  ('client', 'users.invite', false)
on conflict (role, permission) do nothing;

-- Inviters see the invitations and add new ones (only as technician or client).
drop policy if exists "invitations read"   on public.invitations;
drop policy if exists "invitations invite" on public.invitations;
create policy "invitations read" on public.invitations for select to authenticated
  using (public.has_permission('users.invite'));
create policy "invitations invite" on public.invitations for insert to authenticated
  with check (public.has_permission('users.invite') and role in ('technician', 'client'));
