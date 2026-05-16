
CREATE TABLE public.gtfs_routes (
  agency_id text NOT NULL,
  route_id text NOT NULL,
  short_name text,
  long_name text,
  route_type integer,
  PRIMARY KEY (agency_id, route_id)
);
ALTER TABLE public.gtfs_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "GTFS routes public read" ON public.gtfs_routes FOR SELECT USING (true);

CREATE TABLE public.gtfs_trips (
  agency_id text NOT NULL,
  trip_id text NOT NULL,
  route_id text NOT NULL,
  service_id text NOT NULL,
  trip_headsign text,
  direction_id integer,
  PRIMARY KEY (agency_id, trip_id)
);
ALTER TABLE public.gtfs_trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "GTFS trips public read" ON public.gtfs_trips FOR SELECT USING (true);
CREATE INDEX gtfs_trips_service ON public.gtfs_trips (agency_id, service_id);
CREATE INDEX gtfs_trips_route ON public.gtfs_trips (agency_id, route_id);

CREATE TABLE public.gtfs_stop_times (
  agency_id text NOT NULL,
  trip_id text NOT NULL,
  stop_sequence integer NOT NULL,
  stop_id text NOT NULL,
  arrival_seconds integer,
  departure_seconds integer,
  PRIMARY KEY (agency_id, trip_id, stop_sequence)
);
ALTER TABLE public.gtfs_stop_times ENABLE ROW LEVEL SECURITY;
CREATE POLICY "GTFS stop_times public read" ON public.gtfs_stop_times FOR SELECT USING (true);
CREATE INDEX gtfs_stop_times_stop ON public.gtfs_stop_times (agency_id, stop_id);
CREATE INDEX gtfs_stop_times_trip ON public.gtfs_stop_times (agency_id, trip_id);

CREATE TABLE public.gtfs_calendar (
  agency_id text NOT NULL,
  service_id text NOT NULL,
  monday boolean NOT NULL DEFAULT false,
  tuesday boolean NOT NULL DEFAULT false,
  wednesday boolean NOT NULL DEFAULT false,
  thursday boolean NOT NULL DEFAULT false,
  friday boolean NOT NULL DEFAULT false,
  saturday boolean NOT NULL DEFAULT false,
  sunday boolean NOT NULL DEFAULT false,
  start_date date NOT NULL,
  end_date date NOT NULL,
  PRIMARY KEY (agency_id, service_id)
);
ALTER TABLE public.gtfs_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "GTFS calendar public read" ON public.gtfs_calendar FOR SELECT USING (true);

CREATE TABLE public.gtfs_calendar_dates (
  agency_id text NOT NULL,
  service_id text NOT NULL,
  date date NOT NULL,
  exception_type integer NOT NULL,
  PRIMARY KEY (agency_id, service_id, date)
);
ALTER TABLE public.gtfs_calendar_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "GTFS calendar_dates public read" ON public.gtfs_calendar_dates FOR SELECT USING (true);
CREATE INDEX gtfs_calendar_dates_date ON public.gtfs_calendar_dates (agency_id, date);

-- Look up scheduled departures from origin -> destination on a date.
-- Matches GTFS stops by name (so any platform-level stop_id under the
-- station name works), and only returns trips where origin precedes
-- destination in stop_sequence.
CREATE OR REPLACE FUNCTION public.gtfs_departures_between(
  p_agency_id text,
  p_origin_name text,
  p_destination_name text,
  p_date date,
  p_limit integer DEFAULT 30
)
RETURNS TABLE(
  trip_id text,
  route_short_name text,
  route_long_name text,
  trip_headsign text,
  departure_seconds integer,
  arrival_seconds integer
)
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH dow AS (
    SELECT EXTRACT(DOW FROM p_date)::int AS d
  ),
  active_services AS (
    SELECT c.service_id
    FROM public.gtfs_calendar c, dow
    WHERE c.agency_id = p_agency_id
      AND p_date BETWEEN c.start_date AND c.end_date
      AND CASE dow.d
        WHEN 0 THEN c.sunday
        WHEN 1 THEN c.monday
        WHEN 2 THEN c.tuesday
        WHEN 3 THEN c.wednesday
        WHEN 4 THEN c.thursday
        WHEN 5 THEN c.friday
        WHEN 6 THEN c.saturday
      END
    EXCEPT
    SELECT service_id FROM public.gtfs_calendar_dates
    WHERE agency_id = p_agency_id AND date = p_date AND exception_type = 2
    UNION
    SELECT service_id FROM public.gtfs_calendar_dates
    WHERE agency_id = p_agency_id AND date = p_date AND exception_type = 1
  ),
  origin_stops AS (
    SELECT stop_id FROM public.gtfs_stops
    WHERE agency_id = p_agency_id AND name = p_origin_name
  ),
  dest_stops AS (
    SELECT stop_id FROM public.gtfs_stops
    WHERE agency_id = p_agency_id AND name = p_destination_name
  ),
  origin_st AS (
    SELECT st.trip_id, st.departure_seconds, st.stop_sequence
    FROM public.gtfs_stop_times st
    JOIN origin_stops o ON o.stop_id = st.stop_id
    WHERE st.agency_id = p_agency_id
  ),
  dest_st AS (
    SELECT st.trip_id, st.arrival_seconds, st.stop_sequence
    FROM public.gtfs_stop_times st
    JOIN dest_stops d ON d.stop_id = st.stop_id
    WHERE st.agency_id = p_agency_id
  )
  SELECT t.trip_id,
         r.short_name,
         r.long_name,
         t.trip_headsign,
         o.departure_seconds,
         d.arrival_seconds
  FROM origin_st o
  JOIN dest_st d ON d.trip_id = o.trip_id AND d.stop_sequence > o.stop_sequence
  JOIN public.gtfs_trips t ON t.agency_id = p_agency_id AND t.trip_id = o.trip_id
  JOIN active_services a ON a.service_id = t.service_id
  LEFT JOIN public.gtfs_routes r ON r.agency_id = p_agency_id AND r.route_id = t.route_id
  ORDER BY o.departure_seconds
  LIMIT p_limit;
$$;
