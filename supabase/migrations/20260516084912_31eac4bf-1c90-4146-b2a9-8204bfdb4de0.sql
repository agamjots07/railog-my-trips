CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.gtfs_feeds (
  agency_id text PRIMARY KEY,
  name text NOT NULL,
  source_url text NOT NULL,
  last_synced_at timestamptz,
  stop_count int NOT NULL DEFAULT 0,
  shape_count int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.gtfs_stops (
  id text PRIMARY KEY,
  agency_id text NOT NULL REFERENCES public.gtfs_feeds(agency_id) ON DELETE CASCADE,
  stop_id text NOT NULL,
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  mode text NOT NULL,
  parent_station text
);
CREATE INDEX IF NOT EXISTS gtfs_stops_name_trgm ON public.gtfs_stops USING gin (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS gtfs_stops_agency_mode ON public.gtfs_stops (agency_id, mode);

CREATE TABLE IF NOT EXISTS public.gtfs_shapes (
  id text PRIMARY KEY,
  agency_id text NOT NULL REFERENCES public.gtfs_feeds(agency_id) ON DELETE CASCADE,
  shape_id text NOT NULL,
  mode text NOT NULL,
  bbox double precision[] NOT NULL,
  geometry jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS gtfs_shapes_agency_mode ON public.gtfs_shapes (agency_id, mode);

ALTER TABLE public.gtfs_feeds  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtfs_stops  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtfs_shapes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "GTFS feeds public read"  ON public.gtfs_feeds  FOR SELECT USING (true);
CREATE POLICY "GTFS stops public read"  ON public.gtfs_stops  FOR SELECT USING (true);
CREATE POLICY "GTFS shapes public read" ON public.gtfs_shapes FOR SELECT USING (true);