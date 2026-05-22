import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Train, Ship, ChevronLeft, Radio } from "lucide-react";
import { haversineKm } from "@/lib/geo";
import { fetchRouteGeometry, type StationHit } from "@/lib/transitland";
import { StationAutocomplete } from "@/components/StationAutocomplete";
import { toast } from "sonner";

type Departure = {
  trip_id: string;
  route_short_name: string | null;
  route_long_name: string | null;
  trip_headsign: string | null;
  departure_seconds: number;
  arrival_seconds: number;
};

const fmtHM = (s: number) => {
  const h = Math.floor(s / 3600) % 24;
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export const Route = createFileRoute("/_authenticated/new")({
  head: () => ({ meta: [{ title: "Log a trip — Railog" }] }),
  component: NewTrip,
});

function NewTrip() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"train" | "ferry">("train");
  const [logType, setLogType] = useState<"past" | "live">("past");
  const [origin, setOrigin] = useState("");
  const [originStation, setOriginStation] = useState<StationHit | null>(null);
  const [destination, setDestination] = useState("");
  const [destinationStation, setDestinationStation] = useState<StationHit | null>(null);
  const [routeName, setRouteName] = useState("");
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

  const bothGo =
    logType === "past" &&
    mode === "train" &&
    originStation?.id.startsWith("go:") &&
    destinationStation?.id.startsWith("go:");

  useEffect(() => {
    if (!bothGo || !originStation || !destinationStation || !date) {
      setDepartures([]);
      setSelectedTripId("");
      return;
    }
    let cancelled = false;
    setDepLoading(true);
    setSelectedTripId("");
    (async () => {
      const { data, error } = await supabase.rpc("gtfs_departures_between", {
        p_agency_id: "go",
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
  }, [bothGo, originStation, destinationStation, date]);

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
      const o = originStation;
      const d = destinationStation;
      const distance = !isLive && o && d ? haversineKm([o.lat, o.lng], [d.lat, d.lng]) : null;

      let geometry: [number, number][] | null = null;
      if (!isLive && o && d) {
        try {
          geometry = await fetchRouteGeometry(o, d, mode);
        } catch {
          geometry = null;
        }
      }

      const { data, error } = await supabase
        .from("trips")
        .insert({
          user_id: user.id,
          mode,
          origin,
          destination,
          route_name: routeName || null,
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
          notes: notes || null,
          is_live: logType === "live",
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success(
        logType === "live"
          ? "Trip started!"
          : geometry
            ? "Trip logged with real GTFS route shape"
            : "Trip logged",
      );
      nav({ to: "/trip/$id", params: { id: data.id } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
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
        Real GO Transit &amp; TTC stations from GTFS.
      </p>

      <form onSubmit={submit} className="mt-7 space-y-4">
        <Segmented
          value={mode}
          onChange={(v) => {
            setMode(v as "train" | "ferry");
            setOriginStation(null);
            setDestinationStation(null);
          }}
          options={[
            { value: "train", label: "Train", icon: Train },
            { value: "ferry", label: "Ferry", icon: Ship },
          ]}
        />

        <Segmented
          value={logType}
          onChange={(v) => setLogType(v as "past" | "live")}
          options={[
            { value: "past", label: "Past trip" },
            { value: "live", label: "Start live", icon: Radio },
          ]}
        />

        <SectionCard>
          <Field label="Origin">
            <StationAutocomplete
              value={origin}
              onChange={handleOriginChange}
              onSelect={setOriginStation}
              mode={mode}
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
              mode={mode}
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

          {bothGo && (
            <>
              <Divider />
              <Field label="Scheduled GO departure">
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

          {logType === "past" && (
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
            background: "var(--gradient-primary)",
            boxShadow: "var(--shadow-glow)",
          }}
        >
          {busy ? "Saving…" : logType === "live" ? "Start live trip" : "Log trip"}
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

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; icon?: React.ComponentType<React.SVGProps<SVGSVGElement>> }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/[0.06] bg-card/60 p-1 backdrop-blur-xl">
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
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
  );
}
