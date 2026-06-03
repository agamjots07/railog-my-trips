
-- Extend transit_mode enum with new categories
ALTER TYPE public.transit_mode ADD VALUE IF NOT EXISTS 'taxi';
ALTER TYPE public.transit_mode ADD VALUE IF NOT EXISTS 'jetski';
ALTER TYPE public.transit_mode ADD VALUE IF NOT EXISTS 'atv';
ALTER TYPE public.transit_mode ADD VALUE IF NOT EXISTS 'skateboard';
ALTER TYPE public.transit_mode ADD VALUE IF NOT EXISTS 'gondola';

-- Vehicles ("Garage")
CREATE TABLE public.vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  make TEXT,
  model TEXT,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own vehicles" ON public.vehicles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own vehicles" ON public.vehicles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own vehicles" ON public.vehicles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own vehicles" ON public.vehicles
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Link trips to a vehicle (for taxi/uber rides)
ALTER TABLE public.trips ADD COLUMN vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL;
CREATE INDEX trips_vehicle_id_idx ON public.trips(vehicle_id);
