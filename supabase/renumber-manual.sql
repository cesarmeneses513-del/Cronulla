-- Renumbering on demand instead of after every change.
-- Run once in Supabase → SQL Editor, after renumber.sql.
--
-- Renumbering after every change rewrote hundreds of rows each time and flooded the web with
-- live updates, which made saving slow. Now the "No" is only renumbered when an administrator
-- uses Data → Sort and renumber in the web (it calls public.renumber_defects()).
-- New defects get the next free number meanwhile.

drop trigger if exists defects_renumber on public.defects;

-- The web calls the function with the publishable key.
grant execute on function public.renumber_defects() to anon, authenticated;
