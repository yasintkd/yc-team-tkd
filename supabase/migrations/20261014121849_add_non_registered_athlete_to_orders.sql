ALTER TABLE public.athlete_orders ALTER COLUMN athlete_id DROP NOT NULL;
ALTER TABLE public.athlete_orders ADD COLUMN non_registered_athlete_name TEXT;
