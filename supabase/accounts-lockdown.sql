-- Accounts (phase 3 of 3): close the open access. Run once in Supabase → SQL Editor, ONLY when:
--   • roles.sql has been run and everyone who edits has an account with a role (Data → Users), and
--   • both sheet scripts have the secret key saved (menu → "Guardar clave secreta de Supabase").
-- After this, the PINs no longer let anyone edit (the database refuses it).
--
-- Who can do what: the Permissions tab (Data → Users → Permissions) decides, per role:
--   anyone with the link (clients)  see the defects and photos
--   "Crear defectos"                add defects
--   "Editar…", "Subir/Mover/Borrar fotos"  change defects (the web hides the finer actions)
--   "Borrar defectos"               delete defects
--   "Comentario del cliente"        write only the client comment of a defect (nothing else)
--   "Ver Historial"                 read the history; any role that edits writes it
--   "Ordenar y renumerar"           renumber
--   administrators                  also clear the history
--   the sheet scripts               everything, with the secret key (it skips these rules)

-- Defects
drop policy if exists "defects anon read"   on public.defects;
drop policy if exists "defects anon write"  on public.defects;
drop policy if exists "defects read"        on public.defects;
drop policy if exists "defects insert"      on public.defects;
drop policy if exists "defects update"      on public.defects;
drop policy if exists "defects delete"      on public.defects;
create policy "defects read"   on public.defects for select to anon, authenticated using (true);
insert into public.role_permissions (role, permission, allowed) values
  ('admin', 'comments.client', true),
  ('project_manager', 'comments.client', false),
  ('team_leader', 'comments.client', false),
  ('technician', 'comments.client', false),
  ('client', 'comments.client', true)
on conflict (role, permission) do nothing;

create or replace function public.can_edit_defects()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission('defects.edit') or public.has_permission('photos.add')
      or public.has_permission('photos.move') or public.has_permission('photos.delete');
$$;

create or replace function public.can_change_defects()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_edit_defects() or public.has_permission('comments.client');
$$;

-- Roles that may only comment (clients) can't change anything else of the defect.
create or replace function public.only_client_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or public.can_edit_defects() then
    return new;
  end if;
  if (new.data - 'clientComment' - 'clientCommentBy' - 'clientCommentDate')
       is distinct from (old.data - 'clientComment' - 'clientCommentBy' - 'clientCommentDate')
     or new.position is distinct from old.position then
    raise exception 'Only the client comment can be changed';
  end if;
  return new;
end;
$$;
drop trigger if exists defects_only_client_comment on public.defects;
create trigger defects_only_client_comment
  before update on public.defects
  for each row execute function public.only_client_comment();
create policy "defects insert" on public.defects for insert to authenticated with check (public.has_permission('defects.create'));
create policy "defects update" on public.defects for update to authenticated
  using (public.can_change_defects()) with check (public.can_change_defects());
create policy "defects delete" on public.defects for delete to authenticated using (public.has_permission('defects.delete'));

-- Change history (only editors see it in the web)
drop policy if exists "history anon read"   on public.defect_history;
drop policy if exists "history anon insert" on public.defect_history;
drop policy if exists "history anon delete" on public.defect_history;
drop policy if exists "history read"        on public.defect_history;
drop policy if exists "history insert"      on public.defect_history;
drop policy if exists "history delete"      on public.defect_history;
create policy "history read"   on public.defect_history for select to authenticated using (public.has_permission('history.view'));
create policy "history insert" on public.defect_history for insert to authenticated
  with check (public.can_change_defects() or public.has_permission('defects.create') or public.has_permission('defects.delete'));
create policy "history delete" on public.defect_history for delete to authenticated using (public.is_admin());

-- Photos: anyone can see them; only editors upload
drop policy if exists "inspection photos upload" on storage.objects;
create policy "inspection photos upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'inspection-photos' and public.has_permission('photos.add'));

-- Renumbering: administrators only (the web calls renumber_defects_checked)
revoke execute on function public.renumber_defects() from public, anon, authenticated;
create or replace function public.renumber_defects_checked()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('renumber') then
    raise exception 'Not allowed to renumber';
  end if;
  perform public.renumber_defects();
end;
$$;
revoke execute on function public.renumber_defects_checked() from public, anon;
grant execute on function public.renumber_defects_checked() to authenticated;
