-- "Last change" time of each defect, for the "Recent changes" sort.
-- Run once in Supabase → SQL Editor.
--
-- updated_at can't be used for this: it also changes when rows are only renumbered or
-- re-sorted. modified_at changes only when the defect's data really changes, whoever
-- changes it (the web, Glide or the Google Sheet). Renumbering ("No") doesn't count.
-- Safe to run again: it recalculates the times from the change history.

alter table public.defects add column if not exists modified_at timestamptz;

create or replace function public.touch_defect_modified_at()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or (new.data - 'rowNo') is distinct from (old.data - 'rowNo') then
    new.modified_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists defects_modified_at on public.defects;
create trigger defects_modified_at
  before insert or update on public.defects
  for each row execute function public.touch_defect_modified_at();

-- Existing defects: the time of their latest entry in the change history, leaving out
-- entries that only renumbered the row.
update public.defects d
set modified_at = h.last_change
from (
  select d2.id, max(x.created_at) as last_change
  from public.defects d2
  left join public.defect_history x
    on x.defect_id = d2.id
   and not (x.action = 'sheet_edit' and x.details->'fields' = '["rowNo"]'::jsonb)
   and not (x.action = 'edit' and x.details->>'key' = 'rowNo')
  group by d2.id
) h
where h.id = d.id;
