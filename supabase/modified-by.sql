-- "Last modified by" of each defect, for the filter of the same name.
-- Run once in Supabase → SQL Editor, after modified-at.sql. Safe to run again.
--
-- The web sends it with each change it saves (who is signed in). Glide changes take it from
-- their history entry ("Glide · Name" = the technician of the row). Edits from the Google
-- Sheet don't say who made them, and only renumbering the row ("No") doesn't count, so
-- neither changes the name.

alter table public.defects add column if not exists modified_by text;

-- Short names people type when signing in → their full name (keep in sync with
-- src/lib/people.ts). "Ali" and "Ali Madad" are different people.
create or replace function public.canonical_person(name text)
returns text
language sql
immutable
as $$
  select case lower(trim(name))
    when 'cesar' then 'César Meneses'
    when 'césar' then 'César Meneses'
    when 'cesar meneses' then 'César Meneses'
    when 'nicolas' then 'Nicolas Loyola'
    when 'nicolás' then 'Nicolas Loyola'
    when 'natalia' then 'Natalia Onate'
    else nullif(trim(name), '')
  end
$$;

-- The person behind a history entry, or null when it doesn't name one.
create or replace function public.history_person(entry public.defect_history)
returns text
language sql
immutable
as $$
  select case
    when entry.defect_id is null or entry.action = 'delete' then null
    when entry.action = 'sheet_edit' and entry.details->'fields' = '["rowNo"]'::jsonb then null
    when entry.action = 'edit' and entry.details->>'key' = 'rowNo' then null
    else nullif(nullif(public.canonical_person(regexp_replace(entry.user_name, '^Glide · ', '')), 'Google Sheet'), 'planilla')
  end
$$;

-- Each new Glide history entry updates its defect. Only Glide: the script saves the row first
-- and logs it after, so the row already has the new data. The web logs a change before saving
-- the row, and updating the row at that moment would send the phones the old version of it
-- (photos just added would vanish), so the web sends the name with the row instead.
create or replace function public.touch_defect_modified_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  person text := public.history_person(new);
begin
  if person is not null and new.user_name like 'Glide · %' then
    update public.defects set modified_by = person
    where id = new.defect_id and modified_by is distinct from person;
  end if;
  return null;
end;
$$;

drop trigger if exists defect_history_modified_by on public.defect_history;
create trigger defect_history_modified_by
  after insert on public.defect_history
  for each row execute function public.touch_defect_modified_by();

-- A new defect is often logged just before its row is saved: pick the name up then.
create or replace function public.touch_defect_modified_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or (new.data - 'rowNo') is distinct from (old.data - 'rowNo') then
    new.modified_at := now();
  end if;
  if tg_op = 'INSERT' and new.modified_by is null then
    select public.history_person(h) into new.modified_by
    from public.defect_history h
    where h.defect_id = new.id and public.history_person(h) is not null
    order by h.created_at desc
    limit 1;
  end if;
  return new;
end;
$$;

-- Existing defects: the person of their latest history entry that names one.
update public.defects d
set modified_by = x.person
from (
  select distinct on (h.defect_id) h.defect_id, public.history_person(h) as person
  from public.defect_history h
  where public.history_person(h) is not null
  order by h.defect_id, h.created_at desc
) x
where x.defect_id = d.id and d.modified_by is distinct from x.person;
