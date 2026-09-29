-- Automatic "No" (rowNo): 1, 2, 3… in Stage, Drop, Level order, the same order and numbers as
-- column B of the "Cronulla vs Code" sheet (google-sheets/sync.gs).
-- Run once in Supabase → SQL Editor. It renumbers every defect right away, then again after
-- every insert, edit or delete, whoever makes it (the web, Glide or the Google Sheet).
--
-- Numbers are assigned, not typed: a "No" edited by hand is put back on the next change.
-- The old numbers stay in column A of the sheet. Renumbering doesn't count as a change for
-- "Last modified" (modified-at.sql) and isn't logged in the history (client_id 'renumber').
--
-- Order (must match sortForSheet_ in sync.gs): Stage and Drop in natural order (STAGE 2 before
-- STAGE 10), then Level going up the building (G, 1, 2 … then R); blanks last; ties by position.

create or replace function public.renumber_defects()
returns void
language sql
security definer
set search_path = public
as $$
  with keys as (
    select
      id,
      position,
      upper(trim(coalesce(data->>'orientation', ''))) as stage,
      upper(trim(coalesce(data->>'drop', '')))        as drp,
      upper(trim(coalesce(data->>'level', '')))       as lvl
    from public.defects
  ),
  ordered as (
    select
      id,
      row_number() over (
        order by
          stage = '',
          regexp_replace(stage, '\d+', '', 'g'),
          (substring(stage from '\d+'))::numeric nulls first,
          drp = '',
          regexp_replace(drp, '\d+', '', 'g'),
          (substring(drp from '\d+'))::numeric nulls first,
          case
            when lvl = '' then 1000000
            when lvl = 'G' then -1
            when lvl = 'R' then 100000
            when lvl ~ '^\d+(\.\d+)?' then (substring(lvl from '^\d+(?:\.\d+)?'))::numeric
            else 50000
          end,
          lvl,
          position,
          id
      ) as n
    from keys
  )
  update public.defects d
  set data = jsonb_set(d.data, '{rowNo}', to_jsonb(o.n::text)),
      client_id = 'renumber',
      updated_at = now()
  from ordered o
  where o.id = d.id
    and d.data->>'rowNo' is distinct from o.n::text;
$$;

create or replace function public.renumber_defects_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The renumbering's own update fires this trigger again: skip that one.
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  perform public.renumber_defects();
  return null;
end;
$$;

drop trigger if exists defects_renumber on public.defects;
create trigger defects_renumber
  after insert or delete or update of data on public.defects
  for each statement execute function public.renumber_defects_after_change();

-- Number every defect now.
select public.renumber_defects();
