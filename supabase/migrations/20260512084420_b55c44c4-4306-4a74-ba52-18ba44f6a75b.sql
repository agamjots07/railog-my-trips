ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS origin_osm_id TEXT,
  ADD COLUMN IF NOT EXISTS destination_osm_id TEXT,
  ADD COLUMN IF NOT EXISTS route_geometry JSONB;