-- Sites: buildings of one complex grouped under one name (e.g. Altitude: High-Rise and Low-Rise).
-- Run once in Supabase → SQL Editor, after projects.sql (safe to run again).
-- Projects with the same `site` show as one card; opening it lets you choose the building.
alter table public.projects add column if not exists site text not null default '';

-- The site's own photo (the whole complex), shown on its card; each building keeps its own cover.
alter table public.projects add column if not exists site_cover_url text not null default '';
