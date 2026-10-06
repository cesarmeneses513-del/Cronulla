-- Copying the photos that still live in Glide's storage into this project (step 1 of 2).
-- Lets the copy script add files to the "glide" folder of the bucket only; removed again in step 2.
drop policy if exists "inspection photos glide copy (temporary)" on storage.objects;
create policy "inspection photos glide copy (temporary)" on storage.objects for insert to anon
  with check (bucket_id = 'inspection-photos' and (storage.foldername(name))[1] = 'glide');
