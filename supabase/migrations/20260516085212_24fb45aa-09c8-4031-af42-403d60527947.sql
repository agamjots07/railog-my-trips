CREATE OR REPLACE FUNCTION public.gtfs_shapes_near(
  o_lat double precision, o_lng double precision,
  d_lat double precision, d_lng double precision,
  pad   double precision DEFAULT 0.02,
  modes text[] DEFAULT ARRAY['train','subway','tram','ferry']
)
RETURNS TABLE (id text, mode text, geometry jsonb)
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT s.id, s.mode, s.geometry
  FROM public.gtfs_shapes s
  WHERE s.mode = ANY(modes)
    AND s.bbox[1] - pad <= LEAST(o_lat, d_lat)
    AND s.bbox[3] + pad >= GREATEST(o_lat, d_lat)
    AND s.bbox[2] - pad <= LEAST(o_lng, d_lng)
    AND s.bbox[4] + pad >= GREATEST(o_lng, d_lng)
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.gtfs_shapes_near(double precision,double precision,double precision,double precision,double precision,text[]) TO anon, authenticated;