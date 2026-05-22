import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Train, Ship, Route as RouteIcon, Clock, MapPin, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/stats")({
  head: () => ({ meta: [{ title: "Stats — Railog" }] }),
  component: StatsPage,
});

type Trip = Tables<"trips">;

function StatsPage() {
  const [trips, setTrips] = useState<Trip[] | null>(null);

  useEffect(() => {
    supabase.from("trips").select("*").then(({ data }) => setTrips(data ?? []));
  }, []);

  const stats = useMemo(() => {
    if (!trips) return null;
    let totalKm = 0, totalMin = 0, train = 0, ferry = 0, trainKm = 0, ferryKm = 0;
    const routes = new Map<string, number>();
    for (const t of trips) {
      totalKm += t.distance_km ?? 0;
      if (t.end_time) totalMin += (new Date(t.end_time).getTime() - new Date(t.start_time).getTime()) / 60000;
      if (t.mode === "train") { train++; trainKm += t.distance_km ?? 0; }
      else { ferry++; ferryKm += t.distance_km ?? 0; }
      const key = t.route_name || `${t.origin} → ${t.destination}`;
      routes.set(key, (routes.get(key) ?? 0) + 1);
    }
    const top = [...routes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { totalKm, totalMin, train, ferry, trainKm, ferryKm, total: trips.length, top };
  }, [trips]);

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
    <div className="relative px-5 pt-10">
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

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Tile label="Trips" value={`${stats.total}`} icon={RouteIcon} />
        <Tile label="Time" value={fmtH(stats.totalMin)} icon={Clock} />
        <Tile label="Avg trip" value={stats.total ? `${(stats.totalKm / stats.total).toFixed(0)} km` : "0 km"} icon={MapPin} />
        <Tile label="Modes" value={`${stats.train + stats.ferry}`} sub={`${stats.train}T · ${stats.ferry}F`} icon={Train} />
      </div>

      <h2 className="mt-8 mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        Mode breakdown
      </h2>
      <div className="space-y-3">
        <ModeBar icon={Train} label="Train" count={stats.train} km={stats.trainKm} total={stats.total} gradient="var(--gradient-primary)" />
        <ModeBar icon={Ship} label="Ferry" count={stats.ferry} km={stats.ferryKm} total={stats.total} gradient="var(--gradient-ferry)" />
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
