import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { TripMap } from "@/components/TripMap";
import { fmtDate, fmtDuration } from "@/lib/geo";
import { ChevronLeft, Trash2, Train, Ship, StopCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/trip/$id")({
  head: () => ({ meta: [{ title: "Trip — Railog" }] }),
  component: TripDetail,
});

type Trip = Tables<"trips">;

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
  const origin = trip.origin_lat != null && trip.origin_lng != null ? [trip.origin_lat, trip.origin_lng] as [number, number] : null;
  const destination = trip.destination_lat != null && trip.destination_lng != null ? [trip.destination_lat, trip.destination_lng] as [number, number] : null;

  const endLive = async () => {
    const { error } = await supabase.from("trips").update({ end_time: new Date().toISOString(), is_live: false }).eq("id", trip.id);
    if (error) return toast.error(error.message);
    toast.success("Trip ended");
    setTrip({ ...trip, end_time: new Date().toISOString(), is_live: false });
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
      </div>

      <h1 className="text-2xl font-bold tracking-tight">
        {trip.route_name || `${trip.origin} → ${trip.destination}`}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{trip.origin} → {trip.destination}</p>

      <div className="my-5">
        <TripMap origin={origin} destination={destination} mode={trip.mode} height={300} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Date" value={fmtDate(trip.start_time)} />
        <Stat label="Duration" value={fmtDuration(trip.start_time, trip.end_time)} />
        <Stat label="Distance" value={trip.distance_km ? `${trip.distance_km.toFixed(0)} km` : "—"} />
      </div>

      {trip.is_live && !trip.end_time && (
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
