-- Job title "Inspector" is now called "Technician". Run once in Supabase → SQL Editor (safe to run again).
-- The web already shows saved "Inspector" titles as "Technician"; this renames them in the database.
update public.profiles set job_title = 'Technician' where job_title = 'Inspector';
update public.invitations set job_title = 'Technician' where job_title = 'Inspector';
