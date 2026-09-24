-- Change history ("Historial"). Run once in Supabase → SQL Editor, after schema.sql.

-- One row per change. The app writes these as the editor works; the trigger below
-- adds the edits that arrive from the Google Sheet.
create table if not exists public.defect_history (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  user_name   text not null default '',
  action      text not null,          -- photo_add, photo_remove, photo_move, photo_phase, photo_reorder,
                                      -- edit, add, delete, undo, bulk, sheet_add, sheet_edit
  defect_id   text,
  row_no      text,
  details     jsonb not null default '{}'::jsonb
);

create index if not exists defect_history_created_at_idx on public.defect_history (created_at desc);

-- Append-only for the app: it can read and add entries, but not change or delete them.
alter table public.defect_history enable row level security;

drop policy if exists "history anon read"   on public.defect_history;
drop policy if exists "history anon insert" on public.defect_history;
create policy "history anon read"   on public.defect_history for select to anon, authenticated using (true);
create policy "history anon insert" on public.defect_history for insert to anon, authenticated with check (true);

-- Live updates while the history panel is open.
do $$
begin
  alter publication supabase_realtime add table public.defect_history;
exception when duplicate_object then null;
end $$;

-- Log rows created or edited from the Google Sheet (sync.gs writes client_id = 'google-sheet').
create or replace function public.log_sheet_defect_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed text[];
begin
  if new.client_id is distinct from 'google-sheet' then
    return null;
  end if;

  if tg_op = 'INSERT' then
    insert into public.defect_history (user_name, action, defect_id, row_no, details)
    values ('Google Sheet', 'sheet_add', new.id, new.data->>'rowNo',
            jsonb_build_object('defect', new.data->>'defect'));
  else
    select array_agg(n.key order by n.key) into changed
    from jsonb_each(new.data) n
    where n.value is distinct from (old.data -> n.key);

    if changed is not null then
      insert into public.defect_history (user_name, action, defect_id, row_no, details)
      values ('Google Sheet', 'sheet_edit', new.id, new.data->>'rowNo',
              jsonb_build_object('fields', to_jsonb(changed)));
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists defects_sheet_history on public.defects;
create trigger defects_sheet_history
after insert or update on public.defects
for each row execute function public.log_sheet_defect_changes();
