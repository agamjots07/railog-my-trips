import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";
import { Train, Ship, MapPin, LogOut, Radio } from "lucide-react";
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

  return (
    <div className="px-5 pt-8">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Railog</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Your trips</h1>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="rounded-full p-2 text-muted-foreground hover:bg-card hover:text-foreground"
          aria-label="Sign out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      {trips === null && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-card/60" />
          ))}
        </div>
      )}

      {trips?.length === 0 && (
        <div className="mt-16 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-card">
            <Train className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">No trips yet</h2>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Tap the green button below to log your first train or ferry ride.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {trips?.map((t) => <TripCard key={t.id} trip={t} />)}
      </div>
    </div>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  const Icon = trip.mode === "ferry" ? Ship : Train;
  const accent = trip.mode === "ferry" ? "text-[var(--ferry)]" : "text-primary";
  return (
    <Link
      to="/trip/$id"
      params={{ id: trip.id }}
      className="block rounded-2xl border border-border bg-card p-4 transition active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <span className={`flex h-7 w-7 items-center justify-center rounded-lg bg-background ${accent}`}>
              <Icon className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {trip.mode}
            </span>
            {trip.is_live && !trip.end_time && (
              <span className="ml-auto flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                <Radio className="h-3 w-3 animate-pulse" /> Live
              </span>
            )}
          </div>
          <h3 className="truncate text-base font-semibold">
            {trip.route_name || `${trip.origin} → ${trip.destination}`}
          </h3>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {trip.origin} → {trip.destination}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-xs">
        <Stat label="Date" value={fmtDate(trip.start_time)} />
        <Stat label="Duration" value={fmtDuration(trip.start_time, trip.end_time)} />
        <Stat label="Distance" value={trip.distance_km ? `${trip.distance_km.toFixed(0)} km` : "—"} />
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  );
}
