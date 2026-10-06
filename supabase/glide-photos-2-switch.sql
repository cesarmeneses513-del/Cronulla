-- Copying the photos that still live in Glide's storage into this project (step 2 of 2).
-- Run only after every photo has been copied and checked. Closes the temporary door and points
-- each defect's photos at the copies (same file names, in the "glide" folder).
begin;
drop policy if exists "inspection photos glide copy (temporary)" on storage.objects;
alter table public.defects disable trigger defects_only_client_comment;
update public.defects
   set data = replace(
         data::text,
         'https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/XlktfHwJ33nQTBm0LCwM/pub/',
         'https://jawmcsrcgqvndjhhvovl.supabase.co/storage/v1/object/public/inspection-photos/glide/'
       )::jsonb
 where data::text like '%storage.googleapis.com/glide-prod.appspot.com/uploads-v2/XlktfHwJ33nQTBm0LCwM/pub/%';
alter table public.defects enable trigger defects_only_client_comment;
commit;
select count(*) as defects_still_on_glide from public.defects where data::text like '%glide-prod.appspot.com%';
