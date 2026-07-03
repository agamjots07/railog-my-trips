import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Train, Ship, Route as RouteIcon, Clock, MapPin, TrendingUp, Flame, Trophy, Lock, Globe, BarChart3, Car, Gauge, Moon, Building2, CalendarDays } from "lucide-react";
import {
  ACHIEVEMENTS,
  bestStreak,
  currentStreak,
  earnedAchievements,
} from "@/lib/achievements";
import { personalRecords } from "@/lib/personalRecords";
import { distanceComparisons } from "@/lib/distanceComparisons";
import { reverseGeocode, reverseGeocodeDetail } from "@/lib/reverseGeocode";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/stats")({
  head: () => ({ meta: [{ title: "Stats — Pencer" }] }),
  component: StatsPage,
});

type Trip = Tables<"trips">;

function StatsPage() {
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [vehicles, setVehicles] = useState<Tables<"vehicles">[]>([]);
  const [roadLabels, setRoadLabels] = useState<Record<string, { o: string; d: string }>>({});
  const [roadDetails, setRoadDetails] = useState<Record<string, { roads: string[]; cities: string[] }>>({});

  useEffect(() => {
    supabase.from("trips").select("*").then(({ data }) => setTrips(data ?? []));
    supabase.from("vehicles").select("*").then(({ data }) => setVehicles(data ?? []));
  }, []);

  // For road trips missing meaningful origin/destination, reverse-geocode
  // the first & last GPS point so "most frequent route" shows real city names.
  useEffect(() => {
    if (!trips) return;
    let cancelled = false;
    (async () => {
      const generic = new Set(["Live start", "Live", "", null, undefined]);
      const next: Record<string, { o: string; d: string }> = {};
      for (const t of trips) {
        if (t.mode !== "taxi") continue;
        if (!generic.has(t.origin as string) && !generic.has(t.destination as string)) continue;
        const geo = t.route_geometry as unknown as [number, number][] | null;
        if (!geo || geo.length < 2) continue;
        try {
          const o = await reverseGeocode(geo[0]);
          const d = await reverseGeocode(geo[geo.length - 1]);
          if (o && d) {
            next[t.id] = { o, d };
            // Persist so trip history, top routes, and other pages
            // display real place names too.
            await supabase
              .from("trips")
              .update({ origin: o, destination: d })
              .eq("id", t.id);
          }
        } catch { /* skip */ }
        if (cancelled) return;
      }
      if (!cancelled && Object.keys(next).length > 0) {
        setRoadLabels((prev) => ({ ...prev, ...next }));
        // Optimistically update in-memory trips so top routes reflect
        // the resolved names without a refetch.
        setTrips((prev) =>
          prev
            ? prev.map((t) =>
                next[t.id]
                  ? { ...t, origin: next[t.id].o, destination: next[t.id].d }
                  : t,
              )
            : prev,
        );
      }
    })();
    return () => { cancelled = true; };
  }, [trips]);

  // Sample GPS points along each Drive trip to collect road names + cities
  // for "Most travelled road" and "Cities visited by car".
  useEffect(() => {
    if (!trips) return;
    let cancelled = false;
    (async () => {
      const roadTrips = trips.filter((t) => t.mode === "taxi");
      for (const t of roadTrips) {
        if (roadDetails[t.id]) continue;
        const geo = t.route_geometry as unknown as [number, number][] | null;
        if (!geo || geo.length < 2) continue;
        // Sample up to 5 points along the geometry.
        const samples: [number, number][] = [];
        const N = Math.min(5, geo.length);
        for (let i = 0; i < N; i++) {
          const idx = Math.floor((i / Math.max(1, N - 1)) * (geo.length - 1));
          samples.push(geo[idx]);
        }
        const roads = new Set<string>();
        const cities = new Set<string>();
        for (const p of samples) {
          const d = await reverseGeocodeDetail(p);
          if (cancelled) return;
          if (d?.road) roads.add(d.road);
          if (d?.city) cities.add(d.city);
          await new Promise((r) => setTimeout(r, 250)); // gentle rate-limit
        }
        if (cancelled) return;
        setRoadDetails((prev) => ({
          ...prev,
          [t.id]: { roads: [...roads], cities: [...cities] },
        }));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trips]);

  const stats = useMemo(() => {
    if (!trips) return null;
    let totalKm = 0, totalMin = 0, train = 0, ferry = 0, trainKm = 0, ferryKm = 0;
    const routes = new Map<string, number>();
    for (const t of trips) {
      totalKm += t.distance_km ?? 0;
      if (t.end_time) totalMin += (new Date(t.end_time).getTime() - new Date(t.start_time).getTime()) / 60000;
      if (t.mode === "train") { train++; trainKm += t.distance_km ?? 0; }
      else if (t.mode === "ferry") { ferry++; ferryKm += t.distance_km ?? 0; }
      const key = t.route_name || `${t.origin} → ${t.destination}`;
      routes.set(key, (routes.get(key) ?? 0) + 1);
    }
    const top = [...routes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Road-trip specific stats
    const roadTrips = trips.filter((t) => t.mode === "taxi");
    const roadRoutes = new Map<string, number>();
    const roadVehicles = new Map<string, number>();
    let roadMin = 0;
    let longest: { trip: Trip; km: number } | null = null;
    let fastest: { trip: Trip; kmh: number } | null = null;
    for (const t of roadTrips) {
      const resolved = roadLabels[t.id];
      const key = resolved
        ? `${resolved.o} → ${resolved.d}`
        : (t.route_name || `${t.origin} → ${t.destination}`);
      roadRoutes.set(key, (roadRoutes.get(key) ?? 0) + 1);
      if (t.vehicle_id) roadVehicles.set(t.vehicle_id, (roadVehicles.get(t.vehicle_id) ?? 0) + 1);
      if (t.end_time) {
        roadMin += (new Date(t.end_time).getTime() - new Date(t.start_time).getTime()) / 60000;
      }
      if (t.distance_km != null && (!longest || t.distance_km > longest.km)) {
        longest = { trip: t, km: t.distance_km };
      }
      // avg speed: stored or derived
      let kmh: number | null = t.avg_speed_kmh ?? null;
      if (kmh == null && t.distance_km != null && t.end_time) {
        const hrs = (new Date(t.end_time).getTime() - new Date(t.start_time).getTime()) / 3_600_000;
        if (hrs > 0) kmh = t.distance_km / hrs;
      }
      // max speed always beats avg for "fastest"
      const speedForRecord = t.max_speed_kmh ?? kmh;
      if (speedForRecord != null && (!fastest || speedForRecord > fastest.kmh)) {
        fastest = { trip: t, kmh: speedForRecord };
      }
    }
    const topRoadRoute = [...roadRoutes.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    const topVehicleEntry = [...roadVehicles.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

    // New Road insights
    // 1) Most travelled road — aggregate road names across all Drive trips.
    const roadNameCounts = new Map<string, number>();
    // 2) Cities visited by car — unique across Drive trips.
    const citiesSet = new Set<string>();
    for (const t of roadTrips) {
      const d = roadDetails[t.id];
      if (!d) continue;
      for (const r of d.roads) roadNameCounts.set(r, (roadNameCounts.get(r) ?? 0) + 1);
      for (const c of d.cities) citiesSet.add(c);
    }
    const mostTravelledRoad = [...roadNameCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

    // 3) Night rides — Drive trips starting between 22:00 and 04:59.
    let nightRides = 0;
    // 4) Busiest day of week
    const dayCounts = new Array<number>(7).fill(0);
    for (const t of roadTrips) {
      const d = new Date(t.start_time);
      const h = d.getHours();
      if (h >= 22 || h < 5) nightRides++;
      dayCounts[d.getDay()]++;
    }
    const DAY_NAMES: readonly string[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let busiestIdx = -1;
    let busiestMax = 0;
    for (let i = 0; i < 7; i++) {
      const c = dayCounts[i] ?? 0;
      if (c > busiestMax) { busiestMax = c; busiestIdx = i; }
    }
    const busiestDay: { name: string; count: number } | null =
      busiestIdx >= 0 ? { name: DAY_NAMES[busiestIdx] ?? "", count: busiestMax } : null;

    return {
      totalKm, totalMin, train, ferry, trainKm, ferryKm,
      total: trips.length, top,
      records: personalRecords(trips),
      streak: currentStreak(trips),
      best: bestStreak(trips),
      earned: earnedAchievements(trips),
      comparisons: distanceComparisons(totalKm),
      road: {
        count: roadTrips.length,
        totalMin: roadMin,
        topRoute: topRoadRoute,
        topVehicleId: topVehicleEntry?.[0] ?? null,
        topVehicleCount: topVehicleEntry?.[1] ?? 0,
        longest,
        fastest,
        mostTravelledRoad,
        nightRides,
        cities: [...citiesSet].sort(),
        busiestDay,
      },
    };
  }, [trips, roadLabels, roadDetails]);

  if (trips && trips.length === 0) {
    return (
      <div className="px-5 pt-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Stats</p>
        <h1 className="mt-2 text-[34px] font-bold leading-[1.05] tracking-tight">Your travel</h1>
        <EmptyState
          icon={BarChart3}
          eyebrow="Nothing to crunch yet"
          title="Stats unlock with your first trip"
          body="Log a journey and watch your distance, streaks, records and achievements come to life here."
          ctaLabel="Log a trip"
          ctaTo="/new"
        />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="px-5 pt-10 space-y-3">
        {[1,2,3,4].map(i => <div key={i} className="h-28 animate-pulse rounded-3xl bg-card/40" />)}
      </div>
    );
  }

  const fmtH = (m: number) => {
    const h = Math.floor(m / 60); const mm = Math.round(m % 60);
    return h ? `${h}h ${mm}m` : `${mm}m`;
  };

  return (
    <div className="relative px-5 pt-10 pb-10">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 -z-10"
        style={{ background: "var(--gradient-hero)" }}
      />

      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Stats</p>
      <h1 className="mt-2 text-[34px] font-bold leading-[1.05] tracking-tight">Your travel</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        A premium look at every mile you've moved.
      </p>

      {/* Hero stat */}
      <div
        className="mt-6 overflow-hidden rounded-3xl border border-white/[0.06] p-6"
        style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
      >
        <div className="flex items-center gap-2 text-primary-foreground/80">
          <TrendingUp className="h-4 w-4" />
          <span className="text-[11px] font-bold uppercase tracking-[0.18em]">Total distance</span>
        </div>
        <p className="mt-3 font-mono text-6xl font-bold leading-none text-primary-foreground tabular-nums">
          {stats.totalKm.toFixed(0)}
          <span className="ml-2 text-2xl font-semibold opacity-70">km</span>
        </p>
        <p className="mt-3 text-sm font-medium text-primary-foreground/80">
          across {stats.total} {stats.total === 1 ? "trip" : "trips"} · {fmtH(stats.totalMin)} in transit
        </p>
      </div>

      {/* Streak card */}
      <div
        className="mt-4 flex items-center gap-4 rounded-3xl border border-white/[0.06] bg-card p-5"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
          style={{
            background: stats.streak > 0
              ? "linear-gradient(135deg, #f97316, #ef4444)"
              : "rgba(255,255,255,0.05)",
            boxShadow: stats.streak > 0 ? "0 10px 30px -8px rgba(239,68,68,0.5)" : "none",
          }}
        >
          <Flame className={`h-7 w-7 ${stats.streak > 0 ? "text-white" : "text-muted-foreground"}`} strokeWidth={2.5} />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Current streak</p>
          <p className="mt-1 font-mono text-3xl font-bold leading-none tabular-nums">
            {stats.streak}
            <span className="ml-1.5 text-sm font-semibold text-muted-foreground">
              {stats.streak === 1 ? "day" : "days"}
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Best</p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums">{stats.best}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Tile label="Trips" value={`${stats.total}`} icon={RouteIcon} />
        <Tile label="Time" value={fmtH(stats.totalMin)} icon={Clock} />
        <Tile label="Avg trip" value={stats.total ? `${(stats.totalKm / stats.total).toFixed(0)} km` : "0 km"} icon={MapPin} />
        <Tile label="Modes" value={`${stats.train + stats.ferry}`} sub={`${stats.train}T · ${stats.ferry}F`} icon={Train} />
      </div>

      {/* Fun distance comparisons */}
      {stats.comparisons.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            <Globe className="h-3.5 w-3.5" /> Put it in perspective
          </h2>
          <div className="space-y-3">
            {stats.comparisons.map((c, i) => (
              <div
                key={i}
                className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-card p-5"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <div
                  className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-25 blur-3xl"
                  style={{ background: "var(--gradient-primary)" }}
                />
                <p className="relative text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                  {c.label}
                </p>
                <p className="relative mt-2 text-[15px] font-semibold leading-snug">
                  {c.detail}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Personal records */}
      {stats.records.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            <Trophy className="h-3.5 w-3.5" /> Personal records
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {stats.records.map((r) => (
              <div
                key={r.label}
                className="rounded-3xl border border-white/[0.06] bg-card p-4"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                  {r.label}
                </p>
                <p className="mt-2.5 font-mono text-2xl font-bold leading-none tabular-nums">{r.value}</p>
                {r.sub && (
                  <p className="mt-1.5 truncate text-[11px] text-muted-foreground" title={r.sub}>
                    {r.sub}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="mt-8 mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        Mode breakdown
      </h2>
      <div className="space-y-3">
        <ModeBar icon={Train} label="Train" count={stats.train} km={stats.trainKm} total={stats.total} gradient="var(--gradient-primary)" />
        <ModeBar icon={Ship} label="Ferry" count={stats.ferry} km={stats.ferryKm} total={stats.total} gradient="var(--gradient-ferry)" />
      </div>

      {/* Road stats */}
      {stats.road.count > 0 && (() => {
        const r = stats.road;
        const topVehicle = r.topVehicleId ? vehicles.find((v) => v.id === r.topVehicleId) : null;
        const topVehicleLabel = topVehicle
          ? `${topVehicle.name}${topVehicle.make || topVehicle.model ? ` · ${[topVehicle.make, topVehicle.model].filter(Boolean).join(" ")}` : ""}`
          : "—";
        return (
          <>
            <h2 className="mt-8 mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              <Car className="h-3.5 w-3.5" /> Road stats
            </h2>
            <div
              className="rounded-3xl border border-white/[0.06] bg-card p-5"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <RoadRow
                icon={RouteIcon}
                label="Most frequent route"
                value={r.topRoute ? r.topRoute[0] : "—"}
                sub={r.topRoute ? `${r.topRoute[1]} ${r.topRoute[1] === 1 ? "time" : "times"}` : undefined}
              />
              <div className="my-3 h-px bg-white/[0.05]" />
              <RoadRow
                icon={Car}
                label="Most used vehicle"
                value={topVehicleLabel}
                sub={r.topVehicleId ? `${r.topVehicleCount} ${r.topVehicleCount === 1 ? "trip" : "trips"}` : undefined}
              />
              <div className="my-3 h-px bg-white/[0.05]" />
              <RoadRow
                icon={Clock}
                label="Total time as passenger"
                value={fmtH(r.totalMin)}
              />
              <div className="my-3 h-px bg-white/[0.05]" />
              <RoadRow
                icon={MapPin}
                label="Longest trip"
                value={r.longest ? `${r.longest.km.toFixed(r.longest.km < 10 ? 2 : 0)} km` : "—"}
                sub={r.longest ? (r.longest.trip.route_name || `${r.longest.trip.origin} → ${r.longest.trip.destination}`) : undefined}
              />
              <div className="my-3 h-px bg-white/[0.05]" />
              <RoadRow
                icon={Gauge}
                label="Fastest ride"
                value={r.fastest ? `${Math.round(r.fastest.kmh)} km/h` : "—"}
                sub={r.fastest ? (r.fastest.trip.route_name || `${r.fastest.trip.origin} → ${r.fastest.trip.destination}`) : undefined}
              />
              <div className="my-3 h-px bg-white/[0.05]" />
              <RoadRow
                icon={RouteIcon}
                label="Most travelled road"
                value={r.mostTravelledRoad ? r.mostTravelledRoad[0] : "—"}
                sub={r.mostTravelledRoad ? `seen on ${r.mostTravelledRoad[1]} ${r.mostTravelledRoad[1] === 1 ? "trip" : "trips"}` : undefined}
              />
              <div className="my-3 h-px bg-white/[0.05]" />
              <RoadRow
                icon={Moon}
                label="Night rides"
                value={`${r.nightRides}`}
                sub={r.nightRides > 0 ? "after 10pm" : undefined}
              />
              <div className="my-3 h-px bg-white/[0.05]" />
              <RoadRow
                icon={CalendarDays}
                label="Busiest day"
                value={r.busiestDay ? r.busiestDay.name : "—"}
                sub={r.busiestDay ? `${r.busiestDay.count} ${r.busiestDay.count === 1 ? "trip" : "trips"}` : undefined}
              />
              {r.cities.length > 0 && (
                <>
                  <div className="my-3 h-px bg-white/[0.05]" />
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Building2 className="h-4 w-4" strokeWidth={2.5} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                        Cities visited by car
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {r.cities.map((c) => (
                          <span
                            key={c}
                            className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        );
      })()}

      {/* Achievements */}
      <h2 className="mt-8 mb-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        <span>Achievements</span>
        <span className="font-mono text-foreground">
          {stats.earned.length}/{ACHIEVEMENTS.length}
        </span>
      </h2>
      <div className="grid grid-cols-3 gap-3">
        {ACHIEVEMENTS.map((a) => {
          const got = stats.earned.some((e) => e.id === a.id);
          const Icon = got ? a.icon : Lock;
          return (
            <div
              key={a.id}
              className="rounded-2xl border border-white/[0.06] bg-card p-3 text-center"
              style={{
                boxShadow: "var(--shadow-card)",
                opacity: got ? 1 : 0.45,
              }}
            >
              <div
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{
                  background: got ? a.color : "rgba(255,255,255,0.05)",
                  boxShadow: got ? `0 8px 24px -8px ${a.color}80` : "none",
                }}
              >
                <Icon className={`h-6 w-6 ${got ? "text-white" : "text-muted-foreground"}`} strokeWidth={2.5} />
              </div>
              <p className="mt-2 text-[10px] font-bold leading-tight">{a.title}</p>
            </div>
          );
        })}
      </div>

      <h2 className="mt-8 mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        Top routes
      </h2>
      {stats.top.length === 0 ? (
        <p className="text-sm text-muted-foreground">No trips yet.</p>
      ) : (
        <div className="space-y-2">
          {stats.top.map(([name, count], i) => (
            <div
              key={name}
              className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-card px-4 py-3.5"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-background/60 font-mono text-xs font-bold text-muted-foreground">
                {i + 1}
              </span>
              <span className="flex-1 truncate text-sm font-medium">{name}</span>
              <span className="rounded-full bg-primary/15 px-2.5 py-1 font-mono text-xs font-bold text-primary">
                ×{count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Tile({
  label, value, sub, icon: Icon,
}: { label: string; value: string; sub?: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div
      className="rounded-3xl border border-white/[0.06] bg-card p-5"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center justify-between">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="mt-3 font-mono text-3xl font-bold leading-none tabular-nums">{value}</p>
      {sub && <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function RoadRow({
  icon: Icon, label, value, sub,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string; value: string; sub?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Icon className="h-4 w-4" strokeWidth={2.5} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-bold">{value}</p>
      </div>
      {sub && (
        <span className="rounded-full bg-white/[0.06] px-2.5 py-1 font-mono text-[11px] font-bold text-muted-foreground">
          {sub}
        </span>
      )}
    </div>
  );
}

function ModeBar({
  icon: Icon, label, count, km, total, gradient,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string; count: number; km: number; total: number; gradient: string;
}) {
  const pct = total ? (count / total) * 100 : 0;
  return (
    <div
      className="rounded-2xl border border-white/[0.06] bg-card p-4"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-xl text-primary-foreground"
            style={{ background: gradient }}
          >
            <Icon className="h-4 w-4" />
          </span>
          <span className="text-sm font-bold">{label}</span>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm font-bold tabular-nums">{count}</p>
          <p className="font-mono text-[10px] text-muted-foreground">{km.toFixed(0)} km</p>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-background/60">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: gradient }} />
      </div>
    </div>
  );
}
