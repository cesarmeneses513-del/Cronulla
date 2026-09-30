-- Accounts (phase 3 of 3): close the open access. Run once in Supabase → SQL Editor, ONLY when:
--   • everyone who edits has an account with a level (Data → Users in the web), and
--   • both sheet scripts have the secret key saved (menu → "Guardar clave secreta de Supabase").
-- After this, the PINs no longer let anyone edit (the database refuses it).
--
-- Who can do what:
--   anyone with the link (clients)  see the defects and photos
--   editors (level user or admin)   create and edit defects, upload photos, write the history
--   administrators                  also delete defects, clear the history, renumber
--   the sheet scripts               everything, with the secret key (it skips these rules)

-- Defects
drop policy if exists "defects anon read"   on public.defects;
drop policy if exists "defects anon write"  on public.defects;
drop policy if exists "defects read"        on public.defects;
drop policy if exists "defects insert"      on public.defects;
drop policy if exists "defects update"      on public.defects;
drop policy if exists "defects delete"      on public.defects;
create policy "defects read"   on public.defects for select to anon, authenticated using (true);
create policy "defects insert" on public.defects for insert to authenticated with check (public.my_role() in ('admin', 'user'));
create policy "defects update" on public.defects for update to authenticated
  using (public.my_role() in ('admin', 'user')) with check (public.my_role() in ('admin', 'user'));
create policy "defects delete" on public.defects for delete to authenticated using (public.is_admin());

-- Change history (only editors see it in the web)
drop policy if exists "history anon read"   on public.defect_history;
drop policy if exists "history anon insert" on public.defect_history;
drop policy if exists "history anon delete" on public.defect_history;
drop policy if exists "history read"        on public.defect_history;
drop policy if exists "history insert"      on public.defect_history;
drop policy if exists "history delete"      on public.defect_history;
create policy "history read"   on public.defect_history for select to authenticated using (public.my_role() in ('admin', 'user'));
create policy "history insert" on public.defect_history for insert to authenticated with check (public.my_role() in ('admin', 'user'));
create policy "history delete" on public.defect_history for delete to authenticated using (public.is_admin());

-- Photos: anyone can see them; only editors upload
drop policy if exists "inspection photos upload" on storage.objects;
create policy "inspection photos upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'inspection-photos' and public.my_role() in ('admin', 'user'));

-- Renumbering: administrators only (the web calls renumber_defects_checked)
revoke execute on function public.renumber_defects() from public, anon, authenticated;
create or replace function public.renumber_defects_checked()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can renumber';
  end if;
  perform public.renumber_defects();
end;
$$;
revoke execute on function public.renumber_defects_checked() from public, anon;
grant execute on function public.renumber_defects_checked() to authenticated;
