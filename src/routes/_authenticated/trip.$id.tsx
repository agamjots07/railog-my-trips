import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { TripMap } from "@/components/TripMap";
import { fmtDate, fmtDuration } from "@/lib/geo";
import { ChevronLeft, Trash2, StopCircle, Car as CarIcon, Share2, Gauge, Sun } from "lucide-react";
import { toast } from "sonner";
import { useLiveTracking } from "@/lib/useLiveTracking";
import { MODE_COLOR, MODE_ICON, MODE_LABEL, type TripMode } from "@/lib/modes";
import { ShareTripCard } from "@/components/ShareTripCard";
import { GoTrainCard } from "@/components/GoTrainCard";
import { isGoTrip } from "@/lib/goTrains";

export const Route = createFileRoute("/_authenticated/trip/$id")({
  head: () => ({ meta: [{ title: "Trip — Railog" }] }),
  component: TripDetail,
});

type Trip = Tables<"trips">;
type Vehicle = Tables<"vehicles">;
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
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    supabase.from("trips").select("*").eq("id", id).maybeSingle().then(({ data, error }) => {
      if (error) toast.error(error.message);
      setTrip(data);
    });
  }, [id]);

  useEffect(() => {
    if (!trip?.vehicle_id) {
      setVehicle(null);
      return;
    }
    supabase
      .from("vehicles")
      .select("*")
      .eq("id", trip.vehicle_id)
      .maybeSingle()
      .then(({ data }) => setVehicle(data ?? null));
  }, [trip?.vehicle_id]);

  const isLive = !!trip?.is_live && !trip?.end_time;
  const initialPath = useMemo(() => (trip ? parsePath(trip.route_geometry) : []), [trip]);

  const { path: livePath, tracking, error: gpsError, finalize, speedKmh, wakeLockActive } = useLiveTracking({
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

  const mode = trip.mode as TripMode;
  const Icon = MODE_ICON[mode] ?? MODE_ICON.train;
  const color = MODE_COLOR[mode] ?? MODE_COLOR.train;
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
    <div className="relative px-5 pt-6 pb-10">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 -z-10"
        style={{ background: "var(--gradient-hero)" }}
      />

      <div className="mb-5 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1 rounded-full border border-white/[0.06] bg-card/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Trips
        </Link>
        <button
          onClick={remove}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.06] bg-card/60 text-muted-foreground transition hover:text-destructive"
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-2xl text-white"
          style={{ background: color, boxShadow: `0 8px 24px -8px ${color}80` }}
        >
          <Icon className="h-5 w-5" strokeWidth={2.5} />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {MODE_LABEL[mode] ?? trip.mode}
        </span>
        {isLive && (
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary live-dot" />
            {tracking ? "Recording" : "Starting…"}
          </span>
        )}
        {isLive && wakeLockActive && (
          <span
            className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300"
            title="Screen will stay on while recording"
          >
            <Sun className="h-3 w-3" strokeWidth={2.5} /> Awake
          </span>
        )}
      </div>

      <h1 className="text-[26px] font-bold leading-tight tracking-tight">
        {trip.route_name || `${trip.origin} → ${trip.destination}`}
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {trip.origin} → {trip.destination}
      </p>

      <div
        className="my-6 overflow-hidden rounded-3xl border border-white/[0.06]"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <TripMap
          origin={isLive ? null : origin}
          destination={isLive ? null : destination}
          path={path}
          mode={mode}
          height={300}
        />
      </div>

      <div
        className="grid grid-cols-3 overflow-hidden rounded-3xl border border-white/[0.06] bg-card"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <Stat label="Date" value={fmtDate(trip.start_time)} />
        <Stat
          label="Duration"
          value={isLive ? fmtDuration(trip.start_time, new Date().toISOString()) : fmtDuration(trip.start_time, trip.end_time)}
          bordered
        />
        <Stat label="Distance" value={distanceKm ? `${distanceKm.toFixed(distanceKm < 10 ? 2 : 0)} km` : "—"} />
      </div>

      {isLive && (
        <div
          className="mt-5 flex items-center gap-4 rounded-3xl border border-white/[0.06] bg-card p-5"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <span
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-primary"
            style={{ background: `${color}1f` }}
          >
            <Gauge className="h-7 w-7" strokeWidth={2.5} style={{ color }} />
          </span>
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Current speed
            </p>
            <p className="mt-0.5 font-mono text-4xl font-bold tabular-nums leading-none">
              {speedKmh != null ? Math.max(0, Math.round(speedKmh)) : "—"}
              <span className="ml-1.5 text-sm font-semibold text-muted-foreground">km/h</span>
            </p>
          </div>
        </div>
      )}

      {mode === "train" && isGoTrip(trip.origin_osm_id, trip.destination_osm_id) && (
        <GoTrainCard routeName={trip.route_name} />
      )}

      {vehicle && (
        <div
          className="mt-5 flex items-center gap-3 rounded-3xl border border-white/[0.06] bg-card p-4"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <span
            className="flex h-10 w-10 items-center justify-center rounded-2xl text-white"
            style={{ background: vehicle.color || "#fb923c" }}
          >
            <CarIcon className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{vehicle.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle"}
            </p>
          </div>
        </div>
      )}

      {isLive && (
        <button
          onClick={endLive}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-destructive py-4 text-sm font-bold text-destructive-foreground shadow-[0_10px_30px_-10px_oklch(0.64_0.22_24/0.5)] transition active:scale-[0.98]"
        >
          <StopCircle className="h-5 w-5" /> End trip now
        </button>
      )}

      {trip.notes && (
        <div
          className="mt-5 rounded-3xl border border-white/[0.06] bg-card p-5"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Notes
          </p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{trip.notes}</p>
        </div>
      )}

      {!isLive && (
        <button
          onClick={() => setSharing(true)}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground transition active:scale-[0.98]"
          style={{ boxShadow: "var(--shadow-glow)" }}
        >
          <Share2 className="h-5 w-5" /> Share this trip
        </button>
      )}

      {sharing && (
        <ShareTripCard trip={trip} path={path} onClose={() => setSharing(false)} />
      )}
    </div>
  );
}

function Stat({ label, value, bordered }: { label: string; value: string; bordered?: boolean }) {
  return (
    <div className={`px-4 py-4 ${bordered ? "border-x border-white/[0.05]" : ""}`}>
      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 font-mono text-base font-bold tabular-nums">{value}</p>
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
