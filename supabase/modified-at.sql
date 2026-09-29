-- "Last change" time of each defect, for the "Recent changes" sort.
-- Run once in Supabase → SQL Editor.
--
-- updated_at can't be used for this: it also changes when rows are only renumbered or
-- re-sorted. modified_at changes only when the defect's data really changes, whoever
-- changes it (the web, Glide or the Google Sheet).

alter table public.defects add column if not exists modified_at timestamptz;

create or replace function public.touch_defect_modified_at()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or new.data is distinct from old.data then
    new.modified_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists defects_modified_at on public.defects;
create trigger defects_modified_at
  before insert or update on public.defects
  for each row execute function public.touch_defect_modified_at();

-- Existing defects: the time of their latest entry in the change history.
update public.defects d
set modified_at = h.last_change
from (
  select defect_id, max(created_at) as last_change
  from public.defect_history
  where defect_id is not null
  group by defect_id
) h
where h.defect_id = d.id and d.modified_at is null;
