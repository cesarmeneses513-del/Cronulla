-- One name per person in data already saved: the change history and the Start / Done
-- technicians of each defect (Cesar → César Meneses, Nicolas → Nicolas Loyola,
-- Natalia → Natalia Onate; "Ali" stays apart from "Ali Madad").
-- Run once in Supabase → SQL Editor, after modified-by.sql (it uses canonical_person).
-- From now on the web writes full names itself (src/lib/people.ts).

-- 1. Change history (including "Glide · Name" entries).
update public.defect_history
set user_name = case
  when user_name like 'Glide · %' then 'Glide · ' || public.canonical_person(substr(user_name, 9))
  else public.canonical_person(user_name)
end
where coalesce(user_name, '') <> ''
  and user_name <> case
    when user_name like 'Glide · %' then 'Glide · ' || public.canonical_person(substr(user_name, 9))
    else public.canonical_person(user_name)
  end;

-- 2. Technicians of each defect. updated_at changes so both spreadsheets pick the names up;
-- the "last change" time of each defect is kept as it was (renaming isn't a real change).
create temporary table keep_modified_at as select id, modified_at from public.defects;

update public.defects
set data = data
      || jsonb_build_object('technicianStart', coalesce(public.canonical_person(data->>'technicianStart'), ''))
      || jsonb_build_object('technicianCompleted', coalesce(public.canonical_person(data->>'technicianCompleted'), '')),
    client_id = 'data-fix',
    updated_at = now()
where coalesce(data->>'technicianStart', '') <> coalesce(public.canonical_person(data->>'technicianStart'), '')
   or coalesce(data->>'technicianCompleted', '') <> coalesce(public.canonical_person(data->>'technicianCompleted'), '');

update public.defects d
set modified_at = k.modified_at
from keep_modified_at k
where k.id = d.id and d.modified_at is distinct from k.modified_at;

drop table keep_modified_at;
