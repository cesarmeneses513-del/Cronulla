-- TEMPORARY: lets existing photos be replaced by smaller copies in the same place (same links).
-- Run once in Supabase → SQL Editor, then run the "drop policy" line at the bottom when the
-- conversion has finished.
create policy "inspection photos replace (temporary)" on storage.objects for update to anon, authenticated
  using (bucket_id = 'inspection-photos') with check (bucket_id = 'inspection-photos');

-- When done:
-- drop policy "inspection photos replace (temporary)" on storage.objects;
