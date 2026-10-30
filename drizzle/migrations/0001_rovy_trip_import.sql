ALTER TABLE public.trips ADD COLUMN rovy_drive_id text, ADD COLUMN duration_s double precision, ADD COLUMN rovy_destination_pending boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX trips_user_rovy_drive_unique ON public.trips (user_id, rovy_drive_id) WHERE rovy_drive_id IS NOT NULL;
COMMENT ON COLUMN public.trips.rovy_drive_id IS 'Original Rovy drive identifier, unique per owner; import inserts only.';
COMMENT ON COLUMN public.trips.duration_s IS 'Recorded duration in seconds; falls back to timestamp difference when null.';
COMMENT ON COLUMN public.trips.rovy_destination_pending IS 'Resumable destination geocoding queue for imported GPS routes.';