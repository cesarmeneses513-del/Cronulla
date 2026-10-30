-- Facade reference drawings (FCRS) per project, uploaded from the web by administrators
-- (Projects → edit). Run once in Supabase → SQL Editor, after projects.sql (safe to run again).
-- { "NORTH": "https://…jpg", "": "https://…jpg" }: the stage (face) → its drawing; "" is the
-- drawing for defects without a stage (the building's reference photo).
alter table public.projects add column if not exists stage_images jsonb not null default '{}'::jsonb;
