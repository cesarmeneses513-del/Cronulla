-- Lets the History panel's "Clear" button empty the change history.
-- Run once in Supabase → SQL Editor (after history.sql).
drop policy if exists "history anon delete" on public.defect_history;
create policy "history anon delete" on public.defect_history for delete to anon, authenticated using (true);
