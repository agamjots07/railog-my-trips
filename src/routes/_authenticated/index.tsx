import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";
import { Train, Ship, LogOut, Radio, ArrowRight, Sparkles } from "lucide-react";
import { fmtDate, fmtDuration } from "@/lib/geo";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Your trips — Railog" }] }),
  component: FeedPage,
});

type Trip = Tables<"trips">;

function FeedPage() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[] | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("trips")
      .select("*")
      .order("start_time", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setTrips(data ?? []);
      });
  }, [user]);

  const summary = useMemo(() => {
    if (!trips || trips.length === 0) return null;
    const km = trips.reduce((a, t) => a + (t.distance_km ?? 0), 0);
    return { count: trips.length, km };
  }, [trips]);

  return (
    <div className="relative px-5 pt-10">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 -z-10"
        style={{ background: "var(--gradient-hero)" }}
      />

      <header className="mb-7 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-1.5 w-1.5 rounded-full bg-primary live-dot" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Railog
            </p>
          </div>
          <h1 className="mt-2 text-[34px] font-bold leading-[1.05] tracking-tight">
            Your trips
          </h1>
          {summary && (
            <p className="mt-1.5 text-sm text-muted-foreground">
              <span className="font-mono font-semibold text-foreground">{summary.count}</span> rides ·{" "}
              <span className="font-mono font-semibold text-foreground">{summary.km.toFixed(0)}</span> km logged
            </p>
          )}
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.06] bg-card/60 text-muted-foreground transition hover:text-foreground"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      {trips === null && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-3xl bg-card/40" />
          ))}
        </div>
      )}

      {trips?.length === 0 && (
        <div className="mt-12 flex flex-col items-center text-center">
          <div
            className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
          >
            <Train className="h-9 w-9 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <h2 className="text-xl font-bold">Start your journey</h2>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Log your first train or ferry ride and build a beautiful travel timeline.
          </p>
          <Link
            to="/new"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            style={{ boxShadow: "var(--shadow-glow)" }}
          >
            <Sparkles className="h-4 w-4" /> Log a trip
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {trips?.map((t) => <TripCard key={t.id} trip={t} />)}
      </div>
    </div>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  const isFerry = trip.mode === "ferry";
  const Icon = isFerry ? Ship : Train;
  const live = trip.is_live && !trip.end_time;

  return (
    <Link
      to="/trip/$id"
      params={{ id: trip.id }}
      className="group relative block overflow-hidden rounded-3xl border border-white/[0.06] bg-card p-5 transition active:scale-[0.99]"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {/* Mode accent glow */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-3xl transition group-hover:opacity-30"
        style={{ background: isFerry ? "var(--gradient-ferry)" : "var(--gradient-primary)" }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-primary-foreground"
          style={{ background: isFerry ? "var(--gradient-ferry)" : "var(--gradient-primary)" }}
        >
          <Icon className="h-5 w-5" strokeWidth={2.5} />
        </div>
        <div className="flex items-center gap-2">
          {live && (
            <span className="flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary live-dot" /> Live
            </span>
          )}
          <ArrowRight className="h-4 w-4 text-muted-foreground/60 transition group-hover:translate-x-0.5 group-hover:text-foreground" />
        </div>
      </div>

      <div className="relative mt-4">
        <h3 className="truncate text-[17px] font-bold leading-tight">
          {trip.route_name || `${trip.origin} → ${trip.destination}`}
        </h3>
        <div className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <span className="truncate">{trip.origin}</span>
          <ArrowRight className="h-3 w-3 shrink-0 opacity-60" />
          <span className="truncate">{trip.destination}</span>
        </div>
      </div>

      <div className="relative mt-4 flex items-center gap-5 border-t border-white/[0.05] pt-3.5">
        <Stat label="Date" value={fmtDate(trip.start_time)} />
        <div className="h-8 w-px bg-white/[0.05]" />
        <Stat label="Time" value={fmtDuration(trip.start_time, trip.end_time)} />
        <div className="h-8 w-px bg-white/[0.05]" />
        <Stat
          label="Distance"
          value={trip.distance_km ? `${trip.distance_km.toFixed(0)} km` : "—"}
        />
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-sm font-bold text-foreground">{value}</span>
    </div>
  );
}
