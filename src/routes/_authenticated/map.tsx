import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { fmtDate } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { MODE_COLOR, MODE_LABEL, type TripMode } from "@/lib/modes";
import { MapStyleToggle, type MapStyle } from "@/components/MapStyleToggle";

export const Route = createFileRoute("/_authenticated/map")({
  head: () => ({ meta: [{ title: "Journey Map — Railog" }] }),
  component: JourneyMapPage,
});

type Trip = Tables<"trips">;
type LatLng = [number, number];
type Tab = "all" | "rail" | "water" | "road" | "adventure";
type SubMode = TripMode | "lrt" | "monorail";

const SUB_COLORS: Record<SubMode, string> = {
  ...MODE_COLOR,
  lrt: "#2dd4bf",
  monorail: "#facc15",
};

const SUB_LABELS: Record<SubMode, string> = {
  ...MODE_LABEL,
  lrt: "LRT",
  monorail: "Monorail",
};

function classify(trip: Trip): SubMode {
  const m = trip.mode as TripMode;
  if (m === "ferry") return "ferry";
  if (m === "taxi") return "taxi";
  if (m === "jetski" || m === "atv" || m === "skateboard" || m === "gondola") return m;
  // train — refine into lrt/monorail by name keywords
  const hay = `${trip.route_name ?? ""} ${trip.origin} ${trip.destination}`.toLowerCase();
  if (/monorail/.test(hay)) return "monorail";
  if (/\blrt\b|light rail|line 5|line 6|eglinton|finch west|streetcar|tram/.test(hay)) return "lrt";
  return "train";
}

function tripPath(trip: Trip): LatLng[] | null {
  const geom = trip.route_geometry as unknown as LatLng[] | null;
  if (Array.isArray(geom) && geom.length >= 2) {
    return geom.filter(
      (p): p is LatLng =>
        Array.isArray(p) && p.length === 2 && typeof p[0] === "number" && typeof p[1] === "number",
    );
  }
  if (
    typeof trip.origin_lat === "number" &&
    typeof trip.origin_lng === "number" &&
    typeof trip.destination_lat === "number" &&
    typeof trip.destination_lng === "number"
  ) {
    return [
      [trip.origin_lat, trip.origin_lng],
      [trip.destination_lat, trip.destination_lng],
    ];
  }
  return null;
}

function FitAll({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 10);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [points, map]);
  return null;
}

const RAIL_SET = new Set<SubMode>(["train", "lrt", "monorail"]);
const ADV_SET = new Set<SubMode>(["jetski", "atv", "skateboard", "gondola"]);

function JourneyMapPage() {
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [mapStyle, setMapStyle] = useState<MapStyle>("satellite");

  useEffect(() => {
    supabase
      .from("trips")
      .select("*")
      .order("start_time", { ascending: false })
      .then(({ data }) => setTrips(data ?? []));
  }, []);

  const enriched = useMemo(() => {
    if (!trips) return [];
    return trips
      .map((t) => ({ trip: t, sub: classify(t), path: tripPath(t) }))
      .filter((x): x is { trip: Trip; sub: SubMode; path: LatLng[] } => !!x.path);
  }, [trips]);

  const visible = useMemo(() => {
    if (tab === "all") return enriched;
    if (tab === "water") return enriched.filter((x) => x.sub === "ferry");
    if (tab === "rail") return enriched.filter((x) => RAIL_SET.has(x.sub));
    if (tab === "road") return enriched.filter((x) => x.sub === "taxi");
    return enriched.filter((x) => ADV_SET.has(x.sub));
  }, [enriched, tab]);

  const allPoints = useMemo(() => visible.flatMap((x) => x.path), [visible]);

  const legendModes: SubMode[] =
    tab === "water"
      ? ["ferry"]
      : tab === "rail"
        ? ["train", "lrt", "monorail"]
        : tab === "road"
          ? ["taxi"]
          : tab === "adventure"
            ? ["jetski", "atv", "skateboard", "gondola"]
            : ["train", "lrt", "monorail", "ferry", "taxi", "jetski", "atv", "skateboard", "gondola"];

  return (
    <div className="fixed inset-0 bg-background">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        worldCopyJump
        zoomControl={false}
        className="h-full w-full"
      >
        {/* Esri satellite */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri"
          maxZoom={19}
        />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          opacity={0.85}
        />
        {visible.map(({ trip, sub, path }) => (
          <Polyline
            key={trip.id}
            positions={path}
            pathOptions={{
              color: SUB_COLORS[sub],
              weight: 3.5,
              opacity: 0.9,
              dashArray: sub === "ferry" || sub === "jetski" ? "6 6" : undefined,
              lineCap: "round",
              lineJoin: "round",
            }}
          >
            <Popup className="journey-popup">
              <div className="font-display">
                <div
                  className="text-[10px] font-bold uppercase tracking-[0.15em]"
                  style={{ color: SUB_COLORS[sub] }}
                >
                  {SUB_LABELS[sub]}
                </div>
                <div className="mt-1 text-sm font-bold leading-tight text-foreground">
                  {trip.route_name || `${trip.origin} → ${trip.destination}`}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{fmtDate(trip.start_time)}</div>
              </div>
            </Popup>
          </Polyline>
        ))}
        <FitAll points={allPoints} />
      </MapContainer>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <div className="pointer-events-auto">
          <div className="flex items-center gap-2">
            <span className="flex h-1.5 w-1.5 rounded-full bg-primary live-dot" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Journey Map
            </p>
          </div>
          <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight text-foreground">
            Every trip you've taken
          </h1>
        </div>

        <div className="pointer-events-auto mt-4 flex gap-1 overflow-x-auto rounded-full border border-white/[0.06] bg-card/80 p-1 backdrop-blur-xl">
          {(["all", "rail", "road", "water", "adventure"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute right-4 top-[max(env(safe-area-inset-top),0.75rem)] z-[500]">
        <div className="pointer-events-auto rounded-2xl border border-white/[0.06] bg-card/80 p-3 backdrop-blur-xl">
          <div className="space-y-1.5">
            {legendModes.map((m) => (
              <div key={m} className="flex items-center gap-2">
                <span
                  className="h-2 w-4 rounded-full"
                  style={{ background: SUB_COLORS[m], boxShadow: `0 0 8px ${SUB_COLORS[m]}80` }}
                />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground">
                  {SUB_LABELS[m]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {trips !== null && enriched.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center px-6">
          <div className="pointer-events-auto rounded-3xl border border-white/[0.06] bg-card/90 px-6 py-5 text-center backdrop-blur-xl">
            <p className="text-sm font-semibold text-foreground">No journeys yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Log a trip to see it drawn here.</p>
          </div>
        </div>
      )}

      {visible.length > 0 && (
        <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+6rem)] left-1/2 z-[500] -translate-x-1/2">
          <div className="pointer-events-auto rounded-full border border-white/[0.06] bg-card/80 px-4 py-2 backdrop-blur-xl">
            <span className="font-mono text-sm font-bold text-foreground">{visible.length}</span>
            <span className="ml-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {visible.length === 1 ? "route" : "routes"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
