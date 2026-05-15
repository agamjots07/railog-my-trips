import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { TripMap } from "@/components/TripMap";
import { fmtDate, fmtDuration } from "@/lib/geo";
import { ChevronLeft, Trash2, Train, Ship, StopCircle, Radio } from "lucide-react";
import { toast } from "sonner";
import { useLiveTracking } from "@/lib/useLiveTracking";

export const Route = createFileRoute("/_authenticated/trip/$id")({
  head: () => ({ meta: [{ title: "Trip — Railog" }] }),
  component: TripDetail,
});

type Trip = Tables<"trips">;
type LatLng = [number, number];

function parsePath(geom: Trip["route_geometry"]): LatLng[] {
  if (!Array.isArray(geom)) return [];
  return (geom as unknown as unknown[][]).filter(
    (p): p is LatLng =>
      Array.isArray(p) && p.length === 2 && typeof p[0] === "number" && typeof p[1] === "number",
  );
}

function TripDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined);

  useEffect(() => {
    supabase.from("trips").select("*").eq("id", id).maybeSingle().then(({ data, error }) => {
      if (error) toast.error(error.message);
      setTrip(data);
    });
  }, [id]);

  const isLive = !!trip?.is_live && !trip?.end_time;
  const initialPath = useMemo(() => (trip ? parsePath(trip.route_geometry) : []), [trip]);

  const { path: livePath, tracking, error: gpsError, finalize } = useLiveTracking({
    tripId: id,
    enabled: isLive,
    initialPath,
  });

  useEffect(() => {
    if (gpsError) toast.error(`GPS: ${gpsError}`);
  }, [gpsError]);

  if (trip === undefined) {
    return <div className="px-5 pt-10 text-muted-foreground">Loading…</div>;
  }
  if (!trip) {
    return (
      <div className="px-5 pt-10">
        <p className="text-muted-foreground">Trip not found.</p>
        <Link to="/" className="mt-4 inline-block text-sm text-primary">Back to trips</Link>
      </div>
    );
  }

  const Icon = trip.mode === "ferry" ? Ship : Train;
  const origin =
    trip.origin_lat != null && trip.origin_lng != null
      ? ([trip.origin_lat, trip.origin_lng] as LatLng)
      : null;
  const destination =
    trip.destination_lat != null && trip.destination_lng != null
      ? ([trip.destination_lat, trip.destination_lng] as LatLng)
      : null;
  const storedPath = parsePath(trip.route_geometry);
  const path = isLive ? livePath : storedPath;
  const distanceKm = isLive
    ? path.reduce((acc, p, i) => (i === 0 ? 0 : acc + haversine(path[i - 1], p)), 0)
    : trip.distance_km;

  const endLive = async () => {
    try {
      const result = await finalize();
      toast.success("Trip ended");
      setTrip({
        ...trip,
        end_time: result.end_time,
        is_live: false,
        distance_km: result.distance_km,
        route_geometry: result.path as unknown as Trip["route_geometry"],
      });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this trip?")) return;
    const { error } = await supabase.from("trips").delete().eq("id", trip.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    nav({ to: "/" });
  };

  return (
    <div className="px-5 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Trips
        </Link>
        <button onClick={remove} className="rounded-full p-2 text-muted-foreground hover:bg-card hover:text-destructive" aria-label="Delete">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-card ${trip.mode === "ferry" ? "text-[var(--ferry)]" : "text-primary"}`}>
          <Icon className="h-5 w-5" strokeWidth={2.5} />
        </span>
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{trip.mode}</span>
        {isLive && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            <Radio className="h-3 w-3 animate-pulse" /> {tracking ? "Recording" : "Starting…"}
          </span>
        )}
      </div>

      <h1 className="text-2xl font-bold tracking-tight">
        {trip.route_name || `${trip.origin} → ${trip.destination}`}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{trip.origin} → {trip.destination}</p>

      <div className="my-5">
        <TripMap origin={origin} destination={destination} path={path} mode={trip.mode} height={300} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Date" value={fmtDate(trip.start_time)} />
        <Stat
          label="Duration"
          value={isLive ? fmtDuration(trip.start_time, new Date().toISOString()) : fmtDuration(trip.start_time, trip.end_time)}
        />
        <Stat label="Distance" value={distanceKm ? `${distanceKm.toFixed(distanceKm < 10 ? 2 : 0)} km` : "—"} />
      </div>

      {isLive && (
        <button onClick={endLive} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-destructive py-4 text-sm font-semibold text-destructive-foreground transition active:scale-[0.98]">
          <StopCircle className="h-5 w-5" /> End trip now
        </button>
      )}

      {trip.notes && (
        <div className="mt-5 rounded-2xl border border-border bg-card p-4">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</p>
          <p className="text-sm whitespace-pre-wrap">{trip.notes}</p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-base font-semibold">{value}</p>
    </div>
  );
}

function haversine(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
