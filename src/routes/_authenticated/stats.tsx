import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Train, Ship, Route as RouteIcon, Clock, MapPin } from "lucide-react";

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
    return <div className="px-5 pt-10 text-muted-foreground">Loading…</div>;
  }

  const fmtH = (m: number) => {
    const h = Math.floor(m / 60); const mm = Math.round(m % 60);
    return h ? `${h}h ${mm}m` : `${mm}m`;
  };

  return (
    <div className="px-5 pt-8">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Stats</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">Your travel</h1>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Big label="Distance" value={`${stats.totalKm.toFixed(0)}`} unit="km" icon={MapPin} />
        <Big label="Trips" value={`${stats.total}`} unit="" icon={RouteIcon} />
        <Big label="Time" value={fmtH(stats.totalMin)} unit="" icon={Clock} />
        <Big label="Avg distance" value={stats.total ? `${(stats.totalKm / stats.total).toFixed(0)}` : "0"} unit="km" icon={MapPin} />
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Mode breakdown</h2>
      <div className="space-y-3">
        <ModeBar icon={Train} label="Train" count={stats.train} km={stats.trainKm} total={stats.total} color="var(--train)" />
        <ModeBar icon={Ship} label="Ferry" count={stats.ferry} km={stats.ferryKm} total={stats.total} color="var(--ferry)" />
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Most used routes</h2>
      {stats.top.length === 0 ? (
        <p className="text-sm text-muted-foreground">No trips yet.</p>
      ) : (
        <div className="space-y-2">
          {stats.top.map(([name, count]) => (
            <div key={name} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
              <span className="truncate text-sm">{name}</span>
              <span className="ml-3 rounded-full bg-primary/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-primary">×{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Big({ label, value, unit, icon: Icon }: { label: string; value: string; unit: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <p className="mt-3 font-mono text-3xl font-bold leading-none">{value}<span className="ml-1 text-sm font-medium text-muted-foreground">{unit}</span></p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ModeBar({ icon: Icon, label, count, km, total, color }: { icon: React.ComponentType<{ className?: string }>; label: string; count: number; km: number; total: number; color: string }) {
  const pct = total ? (count / total) * 100 : 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color }} />
          <span className="text-sm font-semibold">{label}</span>
        </div>
        <span className="font-mono text-xs text-muted-foreground">{count} trips · {km.toFixed(0)} km</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-background">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
