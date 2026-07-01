ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS avg_speed_kmh double precision,
  ADD COLUMN IF NOT EXISTS max_speed_kmh double precision;