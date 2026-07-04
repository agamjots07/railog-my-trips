import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ChevronLeft, Radio, Car, Sparkles } from "lucide-react";
import { haversineKm } from "@/lib/geo";
import { fetchRouteGeometry, type StationHit } from "@/lib/transitland";
import { StationAutocomplete } from "@/components/StationAutocomplete";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import {
  ADVENTURE_SUBTYPES,
  MODE_COLOR,
  MODE_LABEL,
  isAdventure,
  isLiveOnly,
  type Category,
  type TripMode,
} from "@/lib/modes";

type Departure = {
  trip_id: string;
  route_short_name: string | null;
  route_long_name: string | null;
  trip_headsign: string | null;
  departure_seconds: number;
  arrival_seconds: number;
};

type Vehicle = Tables<"vehicles">;

const fmtHM = (s: number) => {
  const h = Math.floor(s / 3600) % 24;
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export const Route = createFileRoute("/_authenticated/new")({
  head: () => ({ meta: [{ title: "Log a trip — Pencer" }] }),
  component: NewTrip,
});

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "train", label: "Train" },
  { value: "ferry", label: "Ferry" },
  { value: "bus", label: "Bus" },
  { value: "taxi", label: "Drive" },
  { value: "adventure", label: "Adventure" },
];

function NewTrip() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [category, setCategory] = useState<Category>("train");
  // For adventure category, this is the selected subtype; for others it equals the category.
  const [mode, setMode] = useState<TripMode>("train");
  const [logType, setLogType] = useState<"past" | "live">("past");
  const [origin, setOrigin] = useState("");
  const [originStation, setOriginStation] = useState<StationHit | null>(null);
  const [destination, setDestination] = useState("");
  const [destinationStation, setDestinationStation] = useState<StationHit | null>(null);
  const [routeName, setRouteName] = useState("");
  const [label, setLabel] = useState("");
  const [vehicleId, setVehicleId] = useState<string>("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const nowStr = `${pad(today.getHours())}:${pad(today.getMinutes())}`;
  const [date, setDate] = useState(todayStr);
  const [startTime, setStartTime] = useState(nowStr);
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [depLoading, setDepLoading] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string>("");

  const liveOnly = isLiveOnly(mode);
  const isStationMode = mode === "train" || mode === "ferry" || mode === "bus";

  // Force live for live-only modes
  useEffect(() => {
    if (liveOnly && logType !== "live") setLogType("live");
  }, [liveOnly, logType]);

  // Load vehicles
  useEffect(() => {
    if (!user) return;
    supabase
      .from("vehicles")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setVehicles(data ?? []));
  }, [user]);

  const scheduleAgency = (() => {
    if (!isStationMode || logType !== "past") return null;
    const oAgency = originStation?.id.split(":")[0];
    const dAgency = destinationStation?.id.split(":")[0];
    if (!oAgency || oAgency !== dAgency) return null;
    if (["go", "ttc", "tif", "tews", "wif", "bcf"].includes(oAgency)) return oAgency;
    return null;
  })();

  useEffect(() => {
    if (!scheduleAgency || !originStation || !destinationStation || !date) {
      setDepartures([]);
      setSelectedTripId("");
      return;
    }
    let cancelled = false;
    setDepLoading(true);
    setSelectedTripId("");
    (async () => {
      const { data, error } = await supabase.rpc("gtfs_departures_between", {
        p_agency_id: scheduleAgency,
        p_origin_name: originStation.name,
        p_destination_name: destinationStation.name,
        p_date: date,
        p_limit: 50,
      });
      if (cancelled) return;
      setDepartures(error || !data ? [] : (data as Departure[]));
      setDepLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [scheduleAgency, originStation, destinationStation, date]);

  const pickDeparture = (tripId: string) => {
    setSelectedTripId(tripId);
    const dep = departures.find((d) => d.trip_id === tripId);
    if (!dep) return;
    setStartTime(fmtHM(dep.departure_seconds));
    setEndTime(fmtHM(dep.arrival_seconds));
    if (dep.route_short_name) setRouteName(dep.route_short_name);
  };

  const handleOriginChange = (v: string) => {
    setOrigin(v);
    if (originStation && v !== originStation.name) setOriginStation(null);
  };
  const handleDestChange = (v: string) => {
    setDestination(v);
    if (destinationStation && v !== destinationStation.name) setDestinationStation(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const startISO = new Date(`${date}T${startTime}`).toISOString();
      const endISO = logType === "live" || !endTime ? null : new Date(`${date}T${endTime}`).toISOString();
      const isLive = logType === "live";

      let originText = origin;
      let destText = destination;
      let nameText = routeName;
      if (liveOnly) {
        const fallback = label || `${MODE_LABEL[mode]} ride`;
        originText = label || "Live start";
        destText = "Live";
        nameText = nameText || fallback;
      }

      const o = isStationMode ? originStation : null;
      const d = isStationMode ? destinationStation : null;
      const distance = !isLive && o && d ? haversineKm([o.lat, o.lng], [d.lat, d.lng]) : null;

      let geometry: [number, number][] | null = null;
      if (!isLive && o && d) {
        try {
          geometry = await fetchRouteGeometry(o, d, mode === "ferry" ? "ferry" : "train");
        } catch {
          geometry = null;
        }
      }

      // Compute average speed for past trips (km/h) when we have both distance and duration.
      let avgSpeedKmh: number | null = null;
      if (!isLive && distance != null && endISO) {
        const hrs = (new Date(endISO).getTime() - new Date(startISO).getTime()) / 3_600_000;
        if (hrs > 0) avgSpeedKmh = distance / hrs;
      }

      const { data, error } = await supabase
        .from("trips")
        .insert({
          user_id: user.id,
          mode,
          origin: originText,
          destination: destText,
          route_name: nameText || null,
          start_time: startISO,
          end_time: endISO,
          origin_lat: o?.lat ?? null,
          origin_lng: o?.lng ?? null,
          destination_lat: d?.lat ?? null,
          destination_lng: d?.lng ?? null,
          origin_osm_id: o ? o.id : null,
          destination_osm_id: d ? d.id : null,
          route_geometry: geometry,
          distance_km: distance,
          avg_speed_kmh: avgSpeedKmh,
          notes: notes || null,
          is_live: isLive,
          vehicle_id: mode === "taxi" && vehicleId ? vehicleId : null,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success(isLive ? "Trip started!" : geometry ? "Trip logged with route shape" : "Trip logged");
      nav({ to: "/trip/$id", params: { id: data.id } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const setCategoryAndMode = (c: Category) => {
    setCategory(c);
    setOriginStation(null);
    setDestinationStation(null);
    if (c === "adventure") setMode("jetski");
    else setMode(c);
  };

  return (
    <div className="relative px-5 pt-6 pb-10">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 -z-10"
        style={{ background: "var(--gradient-hero)" }}
      />

      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1 rounded-full border border-white/[0.06] bg-card/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Back
      </Link>
      <h1 className="text-[34px] font-bold leading-[1.05] tracking-tight">Log a trip</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Pick a category, then log a past ride or record one live.
      </p>

      <form onSubmit={submit} className="mt-7 space-y-4">
        {/* Category picker */}
        <div className="grid grid-cols-4 gap-1 rounded-2xl border border-white/[0.06] bg-card/60 p-1 backdrop-blur-xl">
          {CATEGORIES.map((c) => {
            const active = c.value === category;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategoryAndMode(c.value)}
                className={`rounded-xl py-2.5 text-xs font-semibold transition ${
                  active
                    ? "bg-primary text-primary-foreground shadow-[0_4px_16px_-6px_oklch(0.82_0.18_152/0.5)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Adventure subtype selector */}
        {category === "adventure" && (
          <SectionCard>
            <Field label="Activity">
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as TripMode)}
                className={inputCls}
              >
                {ADVENTURE_SUBTYPES.map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABEL[m]}
                  </option>
                ))}
              </select>
            </Field>
          </SectionCard>
        )}

        {/* Past vs Live (only for station-based modes) */}
        {!liveOnly && (
          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/[0.06] bg-card/60 p-1 backdrop-blur-xl">
            {[
              { value: "past", label: "Past trip" },
              { value: "live", label: "Start live", icon: Radio },
            ].map((o) => {
              const active = o.value === logType;
              const Icon = o.icon;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setLogType(o.value as "past" | "live")}
                  className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ${
                    active
                      ? "bg-primary text-primary-foreground shadow-[0_4px_16px_-6px_oklch(0.82_0.18_152/0.5)]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {Icon && <Icon className="h-4 w-4" strokeWidth={2.5} />}
                  {o.label}
                </button>
              );
            })}
          </div>
        )}

        {liveOnly && (
          <div
            className="flex items-center gap-3 rounded-2xl border px-4 py-3"
            style={{
              borderColor: `${MODE_COLOR[mode]}40`,
              background: `${MODE_COLOR[mode]}10`,
            }}
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
              style={{ background: MODE_COLOR[mode] }}
            >
              <Radio className="h-4 w-4" strokeWidth={2.75} />
            </span>
            <div>
              <p className="text-[13px] font-bold leading-tight">Live GPS recording</p>
              <p className="text-[11px] text-muted-foreground">
                {MODE_LABEL[mode]} rides record your path in real-time.
              </p>
            </div>
          </div>
        )}

        {/* Station mode form */}
        {isStationMode && (
          <SectionCard>
            <Field label="Origin">
              <StationAutocomplete
                value={origin}
                onChange={handleOriginChange}
                onSelect={setOriginStation}
                mode={mode === "ferry" ? "ferry" : "train"}
                placeholder={mode === "ferry" ? "e.g. Jack Layton Ferry Terminal" : "e.g. Union Station"}
                required
              />
            </Field>
            <Divider />
            <Field label="Destination">
              <StationAutocomplete
                value={destination}
                onChange={handleDestChange}
                onSelect={setDestinationStation}
                mode={mode === "ferry" ? "ferry" : "train"}
                placeholder={mode === "ferry" ? "e.g. Centre Island" : "e.g. Bloor GO"}
                required
              />
            </Field>
            <Divider />
            <Field label="Route name (optional)">
              <input
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="e.g. EC 13"
                className={inputCls}
              />
            </Field>
          </SectionCard>
        )}

        {/* Live-only label + vehicle */}
        {liveOnly && (
          <SectionCard>
            <Field label="Label (optional)">
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={`e.g. Airport to hotel`}
                className={inputCls}
              />
            </Field>
            {mode === "taxi" && (
              <>
                <Divider />
                <Field label="Vehicle">
                  {vehicles.length === 0 ? (
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[13px] text-muted-foreground">No vehicles in your garage yet.</p>
                      <Link
                        to="/garage"
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary"
                      >
                        <Car className="h-3.5 w-3.5" /> Add
                      </Link>
                    </div>
                  ) : (
                    <select
                      value={vehicleId}
                      onChange={(e) => setVehicleId(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">No vehicle</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                          {v.make || v.model ? ` · ${[v.make, v.model].filter(Boolean).join(" ")}` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              </>
            )}
          </SectionCard>
        )}

        <SectionCard>
          <div className="grid grid-cols-2 gap-0">
            <Field label="Date" className="border-r border-white/[0.05] pr-4">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className={inputCls}
              />
            </Field>
            <Field label="Start" className="pl-4">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className={inputCls}
              />
            </Field>
          </div>

          {scheduleAgency && (
            <>
              <Divider />
              <Field label="Scheduled departure">
                {depLoading ? (
                  <div className="text-[15px] text-muted-foreground">Loading schedule…</div>
                ) : departures.length === 0 ? (
                  <div className="text-[15px] text-muted-foreground">
                    No scheduled trips found for this date.
                  </div>
                ) : (
                  <select
                    value={selectedTripId}
                    onChange={(e) => pickDeparture(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Select a departure…</option>
                    {departures.map((d) => (
                      <option key={d.trip_id} value={d.trip_id}>
                        {fmtHM(d.departure_seconds)} → {fmtHM(d.arrival_seconds)}
                        {d.route_short_name ? ` · ${d.route_short_name}` : ""}
                        {d.trip_headsign ? ` · ${d.trip_headsign}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </>
          )}

          {logType === "past" && !liveOnly && (
            <>
              <Divider />
              <Field label="End time (optional)">
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </>
          )}
        </SectionCard>

        <SectionCard>
          <Field label="Notes (optional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={`${inputCls} resize-none`}
              placeholder="Window seat, beautiful sunset…"
            />
          </Field>
        </SectionCard>

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-primary-foreground transition active:scale-[0.98] disabled:opacity-60"
          style={{
            background: liveOnly
              ? `linear-gradient(135deg, ${MODE_COLOR[mode]}, ${MODE_COLOR[mode]}cc)`
              : "var(--gradient-primary)",
            boxShadow: "var(--shadow-glow)",
          }}
        >
          {busy ? "Saving…" : logType === "live" ? (
            <>
              <Sparkles className="h-4 w-4" /> Start {isAdventure(mode) ? MODE_LABEL[mode] : "live trip"}
            </>
          ) : "Log trip"}
        </button>
      </form>
    </div>
  );
}

const inputCls =
  "w-full bg-transparent px-0 py-0.5 text-[15px] font-medium outline-none placeholder:text-muted-foreground/60";

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-3xl border border-white/[0.06] bg-card p-5"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return <div className="my-4 h-px bg-white/[0.05]" />;
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
