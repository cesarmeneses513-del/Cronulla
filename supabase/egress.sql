-- Light loading (less Supabase download traffic). Run once in Supabase → SQL Editor.
-- The web and the sheet now download only the defects changed since their last sync, using
-- updated_at. This makes the database set updated_at with its own clock on every change, so a
-- phone with its clock wrong can't make a change look older than it is (and be missed).

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists defects_set_updated_at on public.defects;
create trigger defects_set_updated_at
  before insert or update on public.defects
  for each row execute function public.set_updated_at();

create index if not exists defects_updated_at_idx on public.defects (updated_at);
