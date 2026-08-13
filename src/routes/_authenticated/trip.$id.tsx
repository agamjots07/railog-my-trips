import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { TripMap } from "@/components/TripMap";
import { fmtDate, fmtDuration, fmtClock } from "@/lib/geo";
import { ChevronLeft, Trash2, StopCircle, Car as CarIcon, Share2, Gauge, Sun, Pause, Play, Loader2, Route as RouteIcon, AlertTriangle, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import { useLiveTracking } from "@/lib/useLiveTracking";
import { isRecordingActive, finalizeFromSaved } from "@/lib/liveRecovery";
import { RouteBuilder } from "@/components/RouteBuilder";
import { MODE_COLOR, MODE_ICON, MODE_LABEL, type TripMode } from "@/lib/modes";
import { ShareTripCard } from "@/components/ShareTripCard";
import { GoTrainCard } from "@/components/GoTrainCard";
import { isGoTrip } from "@/lib/goTrains";


export const Route = createFileRoute("/_authenticated/trip/$id")({
  head: () => ({ meta: [{ title: "Trip — Pencer" }] }),
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

// <input type="datetime-local"> works in local time with no timezone suffix.
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}


function TripDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [sharing, setSharing] = useState(false);
  const [building, setBuilding] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [editingMode, setEditingMode] = useState(false);
  const [savingMode, setSavingMode] = useState(false);
  const [editingTime, setEditingTime] = useState(false);
  const [savingTime, setSavingTime] = useState(false);
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");

  useEffect(() => {
    supabase.from("trips").select("*").eq("id", id).maybeSingle().then(({ data, error }) => {
      if (error) toast.error(error.message);
      setTrip(data);
      // Interrupted recording: trip is still live but no tab is recording it.
      if (data?.is_live && !data.end_time && !isRecordingActive(id)) setRecovery(true);
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

  const { path: livePath, tracking, error: gpsError, finalize, speedKmh, wakeLockActive, paused, pausedMs, warmingUp, distanceKm: liveDistanceKm, togglePause } = useLiveTracking({
    tripId: id,
    enabled: isLive && !recovery,
    initialPath,
  });

  useEffect(() => {
    if (gpsError) toast.error(`GPS: ${gpsError}`);
  }, [gpsError]);

  const playback = usePlayback(initialPath);


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
  const distanceKm = isLive ? liveDistanceKm : trip.distance_km;

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

  // Change only the transport mode — every other field is left untouched.
  const changeMode = async (next: TripMode) => {
    if (next === mode) {
      setEditingMode(false);
      return;
    }
    setSavingMode(true);
    const { error } = await supabase.from("trips").update({ mode: next }).eq("id", trip.id);
    setSavingMode(false);
    if (error) return toast.error(error.message);
    setTrip({ ...trip, mode: next });
    setEditingMode(false);
    toast.success(`Changed to ${MODE_LABEL[next]}`);
  };

  const openTimeEditor = () => {
    setStartInput(toLocalInput(trip.start_time));
    setEndInput(toLocalInput(trip.end_time));
    setEditingTime(true);
  };

  // Change only the date/time fields — distance, route and notes are untouched.
  const saveTimes = async () => {
    const start = fromLocalInput(startInput);
    if (!start) return toast.error("Pick a valid start date and time");
    const end = fromLocalInput(endInput);
    if (end && new Date(end).getTime() < new Date(start).getTime()) {
      return toast.error("End time must be after the start time");
    }
    setSavingTime(true);
    const { error } = await supabase
      .from("trips")
      .update({ start_time: start, end_time: end })
      .eq("id", trip.id);
    setSavingTime(false);
    if (error) return toast.error(error.message);
    setTrip({ ...trip, start_time: start, end_time: end });
    setEditingTime(false);
    toast.success("Date & time updated");
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
        <button
          type="button"
          onClick={() => setEditingMode((v) => !v)}
          aria-label="Change transport mode"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.06] bg-card/60 text-muted-foreground transition hover:text-foreground"
        >
          <Pencil className="h-3 w-3" strokeWidth={2.5} />
        </button>

        {isLive && (
          paused ? (
            <span className="ml-auto flex items-center gap-1.5 rounded-full bg-amber-400/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
              <Pause className="h-3 w-3" strokeWidth={2.75} /> Paused
            </span>
          ) : warmingUp ? (
            <span className="ml-auto flex items-center gap-1.5 rounded-full bg-sky-400/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-300">
              <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.75} /> GPS lock…
            </span>
          ) : (
            <span className="ml-auto flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary live-dot" />
              {tracking ? "Recording" : "Starting…"}
            </span>
          )
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

      {editingMode && (
        <div className="mb-4 rounded-3xl border border-white/[0.06] bg-card/60 p-3 backdrop-blur-xl">
          <p className="px-1 pb-2 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Transport mode
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {(Object.keys(MODE_LABEL) as TripMode[]).map((m) => {
              const MIcon = MODE_ICON[m];
              const active = m === mode;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={savingMode}
                  onClick={() => changeMode(m)}
                  className={`flex flex-col items-center gap-1 rounded-2xl border px-1 py-2.5 text-[10px] font-semibold transition disabled:opacity-50 ${
                    active
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-white/[0.06] text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <MIcon className="h-4 w-4" strokeWidth={2.25} />
                  {MODE_LABEL[m]}
                  {active && <Check className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
        </div>
      )}



      <h1 className="text-[26px] font-bold leading-tight tracking-tight">
        {trip.route_name || `${trip.origin} → ${trip.destination}`}
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {trip.origin} → {trip.destination}
      </p>

      {recovery && (
        <div className="mt-5 rounded-3xl border border-amber-400/30 bg-amber-400/10 p-4">
          <div className="flex items-center gap-2 text-amber-300">
            <AlertTriangle className="h-4 w-4" strokeWidth={2.5} />
            <p className="text-[11px] font-bold uppercase tracking-[0.18em]">Recording interrupted</p>
          </div>
          <p className="mt-1.5 text-xs text-amber-200/80">
            This trip was still recording when the app closed. {storedPath.length} GPS point
            {storedPath.length === 1 ? "" : "s"} were saved.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              onClick={() => setRecovery(false)}
              className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground active:scale-[0.98]"
            >
              <Play className="h-4 w-4" /> Resume
            </button>
            <button
              disabled={recovering}
              onClick={async () => {
                setRecovering(true);
                try {
                  const r = await finalizeFromSaved(trip.id);
                  setTrip({ ...trip, is_live: false, end_time: r.end_time, distance_km: r.distance_km });
                  setRecovery(false);
                  toast.success("Trip finalized from saved points");
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setRecovering(false);
                }
              }}
              className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-card py-3 text-sm font-bold active:scale-[0.98] disabled:opacity-60"
            >
              {recovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <StopCircle className="h-4 w-4" />}
              Finalize
            </button>
          </div>
        </div>
      )}


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
          value={isLive ? fmtDuration(trip.start_time, new Date(Date.now() - pausedMs).toISOString()) : fmtDuration(trip.start_time, trip.end_time)}
          bordered
        />
        <Stat label="Distance" value={distanceKm ? `${distanceKm.toFixed(distanceKm < 10 ? 2 : 0)} km` : "—"} />
      </div>

      {mode === "taxi" && !isLive && (
        <p className="mt-3 text-center text-[12px] font-semibold text-muted-foreground">
          Started {fmtClock(trip.start_time)}
          {trip.end_time ? ` — Ended ${fmtClock(trip.end_time)}` : ""}
        </p>
      )}

      {!isLive && (
        editingTime ? (
          <div className="mt-3 rounded-3xl border border-white/[0.06] bg-card/60 p-4 backdrop-blur-xl">
            <p className="pb-2 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Edit date & time
            </p>
            <label className="block text-[11px] font-semibold text-muted-foreground">
              Start
              <input
                type="datetime-local"
                value={startInput}
                onChange={(e) => setStartInput(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-white/[0.08] bg-background px-3 py-2.5 text-sm font-semibold text-foreground"
              />
            </label>
            <label className="mt-3 block text-[11px] font-semibold text-muted-foreground">
              End
              <input
                type="datetime-local"
                value={endInput}
                onChange={(e) => setEndInput(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-white/[0.08] bg-background px-3 py-2.5 text-sm font-semibold text-foreground"
              />
            </label>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => setEditingTime(false)}
                className="rounded-2xl border border-white/[0.08] bg-card py-3 text-sm font-bold active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={saveTimes}
                disabled={savingTime}
                className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground active:scale-[0.98] disabled:opacity-60"
              >
                {savingTime ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={openTimeEditor}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-card/60 py-3 text-xs font-bold text-muted-foreground transition active:scale-[0.98] hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit date & time
          </button>
        )
      )}



      {isLive ? (
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
      ) : (() => {
        // Compute avg from distance/duration if not stored, and use stored max if available.
        const savedAvg = trip.avg_speed_kmh ?? null;
        const savedMax = trip.max_speed_kmh ?? null;
        let avg = savedAvg;
        if (avg == null && trip.distance_km != null && trip.end_time) {
          const hrs = (new Date(trip.end_time).getTime() - new Date(trip.start_time).getTime()) / 3_600_000;
          if (hrs > 0) avg = trip.distance_km / hrs;
        }
        if (avg == null && savedMax == null) return null;
        return (
          <div
            className="mt-5 grid grid-cols-2 overflow-hidden rounded-3xl border border-white/[0.06] bg-card"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="flex items-center gap-3 px-5 py-4">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{ background: `${color}1f` }}
              >
                <Gauge className="h-5 w-5" strokeWidth={2.5} style={{ color }} />
              </span>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                  Avg speed
                </p>
                <p className="mt-1 font-mono text-xl font-bold tabular-nums leading-none">
                  {avg != null ? Math.round(avg) : "—"}
                  <span className="ml-1 text-[10px] font-semibold text-muted-foreground">km/h</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-l border-white/[0.05] px-5 py-4">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{ background: `${color}1f` }}
              >
                <Gauge className="h-5 w-5" strokeWidth={2.5} style={{ color }} />
              </span>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                  Top speed
                </p>
                <p className="mt-1 font-mono text-xl font-bold tabular-nums leading-none">
                  {savedMax != null ? Math.round(savedMax) : "—"}
                  <span className="ml-1 text-[10px] font-semibold text-muted-foreground">km/h</span>
                </p>
              </div>
            </div>
          </div>
        );
      })()}

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

      {isLive && paused && (
        <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300">Trip paused</p>
          <p className="mt-1 text-xs text-amber-200/80">
            GPS is off. Paused time won't count toward duration or distance.
          </p>
        </div>
      )}

      {isLive && !recovery && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={togglePause}
            className={`flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold transition active:scale-[0.98] ${
              paused
                ? "bg-primary text-primary-foreground"
                : "border border-white/[0.08] bg-card text-foreground"
            }`}
            style={paused ? { boxShadow: "var(--shadow-glow)" } : undefined}
          >
            {paused ? (
              <>
                <Play className="h-5 w-5" /> Resume
              </>
            ) : (
              <>
                <Pause className="h-5 w-5" /> Pause
              </>
            )}
          </button>
          <button
            onClick={endLive}
            className="flex items-center justify-center gap-2 rounded-2xl bg-destructive py-4 text-sm font-bold text-destructive-foreground shadow-[0_10px_30px_-10px_oklch(0.64_0.22_24/0.5)] transition active:scale-[0.98]"
          >
            <StopCircle className="h-5 w-5" /> End trip
          </button>
        </div>
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
          onClick={() => setBuilding(true)}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-card py-4 text-sm font-bold text-foreground transition active:scale-[0.98]"
        >
          <RouteIcon className="h-5 w-5" />
          {storedPath.length >= 2 ? "Edit route & top speed" : "Add route"}
        </button>
      )}

      {building && (
        <RouteBuilder
          tripId={trip.id}
          mode={mode}
          center={origin ?? storedPath[0] ?? null}
          initialPath={storedPath}
          initialTopSpeed={trip.max_speed_kmh}
          onClose={() => setBuilding(false)}
          onSaved={({ path: p, distanceKm: km, maxSpeed }) =>
            setTrip({
              ...trip,
              route_geometry: p as unknown as Trip["route_geometry"],
              distance_km: km,
              max_speed_kmh: maxSpeed ?? trip.max_speed_kmh,
            })
          }
        />
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
        <ShareTripCard trip={trip} path={path} vehicle={vehicle} onClose={() => setSharing(false)} />
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
