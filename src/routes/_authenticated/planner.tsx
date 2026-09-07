import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Navigation, Plus, X, GripVertical } from "lucide-react";
import { GoogleMapCanvas, useMapProvider } from "@/components/GoogleMapCanvas";
import { MapStyleToggle, type MapStyle } from "@/components/MapStyleToggle";
import { useGoogleMaps } from "@/lib/useGoogleMaps";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/planner")({
  head: () => ({
    meta: [
      { title: "Route Planner — Pencer" },
      {
        name: "description",
        content:
          "Plan any driving route with Google Maps — enter an origin, destination and optional stops to see the full path, distance and travel time.",
      },
      { property: "og:title", content: "Route Planner — Pencer" },
      {
        property: "og:description",
        content: "Plan driving routes with stops, distance and travel time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlannerPage,
});

type LatLng = [number, number];
type Waypoint = { id: number; text: string };

type LegInfo = {
  start: string;
  end: string;
  distanceText: string;
  durationText: string;
  distanceM: number;
  durationS: number;
};

function fmtTotal(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** Text input with Google Places (New) autocomplete suggestions. */
function PlaceInput({
  value,
  onChange,
  placeholder,
  color,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  color: string;
}) {
  const { status, google } = useGoogleMaps();
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const sessionRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const query = (text: string) => {
    onChange(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim() || status !== "ready") {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const { AutocompleteSuggestion, AutocompleteSessionToken } =
          (await google.maps.importLibrary("places")) as any;
        if (!sessionRef.current) sessionRef.current = new AutocompleteSessionToken();
        const { suggestions: s } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: text,
          sessionToken: sessionRef.current,
        });
        setSuggestions(s ?? []);
        setOpen(true);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  };

  const pick = (s: any) => {
    const p = s?.placePrediction;
    if (!p) return;
    onChange(p.text?.text ?? p.mainText?.text ?? "");
    setSuggestions([]);
    setOpen(false);
    sessionRef.current = null;
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-card/80 px-3 py-2.5 backdrop-blur-xl">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
        <input
          value={value}
          onChange={(e) => query(e.target.value)}
          onFocus={() => suggestions.length && setOpen(true)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setSuggestions([]);
            }}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Clear"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute inset-x-0 top-full z-[600] mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-white/[0.08] bg-card/95 shadow-xl backdrop-blur-xl">
          {suggestions.map((s, i) => {
            const p = s.placePrediction;
            if (!p) return null;
            return (
              <button
                key={i}
                type="button"
                onClick={() => pick(s)}
                className="flex w-full flex-col px-3 py-2 text-left hover:bg-white/[0.04]"
              >
                <span className="text-sm font-medium text-foreground">
                  {p.mainText?.text ?? p.text?.text}
                </span>
                {p.secondaryText?.text && (
                  <span className="text-xs text-muted-foreground">{p.secondaryText.text}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlannerPage() {
  const { status, google } = useGoogleMaps();
  const { provider } = useMapProvider();
  const [style, setStyle] = useState<MapStyle>("road");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legs, setLegs] = useState<LegInfo[] | null>(null);
  const [path, setPath] = useState<LatLng[] | null>(null);
  const nextId = useRef(1);

  const canSearch = origin.trim().length > 1 && destination.trim().length > 1;

  const search = useCallback(async () => {
    if (!canSearch || status !== "ready" || !google?.maps) return;
    setLoading(true);
    setError(null);
    try {
      const addresses = [origin.trim(), ...waypoints.map((w) => w.text.trim()).filter(Boolean), destination.trim()];
      // Geocode each address with Places (New)
      const { Place } = (await google.maps.importLibrary("places")) as any;
      const coords: { lat: number; lng: number; name: string }[] = [];
      for (const addr of addresses) {
        const q = await Place.searchByText({
          textQuery: addr,
          fields: ["location", "displayName"],
          maxResultCount: 1,
        });
        const pl = q?.places?.[0];
        if (!pl?.location) throw Object.assign(new Error("geocode"), { addr });
        coords.push({ lat: pl.location.lat(), lng: pl.location.lng(), name: pl.displayName ?? addr });
      }

      // Try Google Routes API first (requires Routes API enabled on the key);
      // fall back to the free OSRM routing engine.
      let pts: LatLng[] | null = null;
      let legInfos: LegInfo[] | null = null;
      const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
      try {
        const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask":
              "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.distanceMeters,routes.legs.duration,routes.legs.polyline.encodedPolyline",
          },
          body: JSON.stringify({
            origin: { location: { latLng: { latitude: coords[0].lat, longitude: coords[0].lng } } },
            destination: {
              location: { latLng: { latitude: coords[coords.length - 1].lat, longitude: coords[coords.length - 1].lng } },
            },
            intermediates: coords.slice(1, -1).map((c) => ({
              location: { latLng: { latitude: c.lat, longitude: c.lng } },
            })),
            travelMode: "DRIVE",
          }),
        });
        if (!res.ok) throw new Error(`routes ${res.status}`);
        const data = await res.json();
        const route = data.routes?.[0];
        if (!route) throw new Error("no route");
        pts = decodePolyline(route.polyline.encodedPolyline);
        legInfos = (route.legs ?? []).map((l: any, i: number) => ({
          start: coords[i]?.name ?? "",
          end: coords[i + 1]?.name ?? "",
          distanceText: `${(l.distanceMeters / 1000).toFixed(1)} km`,
          durationText: fmtTotal(Math.round(parseFloat(String(l.duration).replace("s", "")) / 60)),
          distanceM: l.distanceMeters,
          durationS: parseFloat(String(l.duration).replace("s", "")),
        }));
      } catch {
        // OSRM fallback — free public routing, no key needed.
        const coordStr = coords.map((c) => `${c.lng},${c.lat}`).join(";");
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson&steps=false`,
        );
        if (!res.ok) throw new Error("osrm failed");
        const data = await res.json();
        const route = data.routes?.[0];
        if (!route) throw new Error("no route");
        pts = route.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as LatLng);
        legInfos = (route.legs ?? []).map((l: any, i: number) => ({
          start: coords[i]?.name ?? "",
          end: coords[i + 1]?.name ?? "",
          distanceText: `${(l.distance / 1000).toFixed(1)} km`,
          durationText: fmtTotal(Math.round(l.duration / 60)),
          distanceM: l.distance,
          durationS: l.duration,
        }));
      }

      setPath(pts.length >= 2 ? pts : null);
      setLegs(legInfos);
    } catch (e: any) {
      setPath(null);
      setLegs(null);
      setError(
        e?.addr
          ? `Couldn't find "${e.addr}". Try a more specific name or address.`
          : "Couldn't find that route. Check the place names and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [canSearch, status, google, origin, destination, waypoints]);

  const totals = useMemo(() => {
    if (!legs?.length) return null;
    const km = legs.reduce((s, l) => s + l.distanceM, 0) / 1000;
    const mins = Math.round(legs.reduce((s, l) => s + l.durationS, 0) / 60);
    return { km, mins };
  }, [legs]);

  const gRoutes = useMemo(
    () => (path ? [{ id: "plan", points: path, color: "#3b82f6", weight: 5 }] : []),
    [path],
  );
  const gStops = useMemo(() => {
    if (!path || path.length < 2) return [];
    const stops = [
      { pos: path[0], color: "#22c55e", scale: 7, title: "Origin" },
      { pos: path[path.length - 1], color: "#ef4444", scale: 7, title: "Destination" },
    ];
    // Waypoint markers approximated from leg boundaries
    if (legs && legs.length > 1 && path.length > legs.length) {
      // Evenly sample boundaries as approximation isn't needed — use leg start locations via geocoded path steps is complex; skip mid markers.
    }
    return stops;
  }, [path, legs]);

  return (
    <div className="relative flex h-[100dvh] flex-col">
      <div className="absolute inset-0">
        {provider === "google" ? (
          <GoogleMapCanvas
            style={style}
            routes={gRoutes}
            stops={gStops}
            fit={!!path}
            center={[43.65, -79.38]}
            zoom={7}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-background px-8 text-center text-sm text-muted-foreground">
            Route planner needs Google Maps, which is unavailable right now.
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <div className="pointer-events-auto space-y-2">
          <div className="flex items-center gap-2">
            <Link
              to="/map"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.06] bg-card/80 text-foreground backdrop-blur-xl"
              aria-label="Back to map"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex-1 rounded-full border border-white/[0.06] bg-card/80 px-4 py-2 backdrop-blur-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Route Planner
              </p>
            </div>
            <div className="rounded-full border border-white/[0.06] bg-card/80 p-1 backdrop-blur-xl">
              <MapStyleToggle value={style} onChange={setStyle} />
            </div>
          </div>

          <div className="space-y-2">
            <PlaceInput value={origin} onChange={setOrigin} placeholder="Origin" color="#22c55e" />
            {waypoints.map((w, i) => (
              <div key={w.id} className="flex items-center gap-1.5">
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                <div className="flex-1">
                  <PlaceInput
                    value={w.text}
                    onChange={(v) =>
                      setWaypoints((prev) => prev.map((p) => (p.id === w.id ? { ...p, text: v } : p)))
                    }
                    placeholder={`Stop ${i + 1}`}
                    color="#f59e0b"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setWaypoints((prev) => prev.filter((p) => p.id !== w.id))}
                  className="shrink-0 rounded-full border border-white/[0.06] bg-card/80 p-2 text-muted-foreground backdrop-blur-xl hover:text-foreground"
                  aria-label="Remove stop"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <PlaceInput
              value={destination}
              onChange={setDestination}
              placeholder="Destination"
              color="#ef4444"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setWaypoints((prev) => [...prev, { id: nextId.current++, text: "" }])}
              className="flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-card/80 px-3.5 py-2 text-xs font-semibold text-foreground backdrop-blur-xl"
            >
              <Plus className="h-3.5 w-3.5" /> Add stop
            </button>
            <button
              type="button"
              onClick={search}
              disabled={!canSearch || loading || status !== "ready"}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground transition",
                (!canSearch || loading) && "opacity-50",
              )}
              style={{ background: "var(--gradient-primary)" }}
            >
              <Navigation className="h-3.5 w-3.5" />
              {loading ? "Routing…" : "Get route"}
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-destructive/40 bg-card/90 px-3 py-2 text-xs text-destructive backdrop-blur-xl">
              {error}
            </div>
          )}
        </div>
      </div>

      {totals && legs && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] px-4 pb-[calc(max(env(safe-area-inset-bottom),0.75rem)+6.5rem)]">
          <div className="pointer-events-auto max-h-64 overflow-y-auto rounded-2xl border border-white/[0.06] bg-card/90 p-4 backdrop-blur-xl">
            <div className="flex items-baseline justify-between">
              <p className="text-xl font-bold text-foreground">{fmtTotal(totals.mins)}</p>
              <p className="text-sm font-semibold text-muted-foreground">
                {totals.km < 10 ? totals.km.toFixed(1) : Math.round(totals.km)} km
              </p>
            </div>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Fastest route · typical traffic
            </p>
            <div className="mt-3 space-y-2">
              {legs.map((l, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {l.start.split(",")[0]} → {l.end.split(",")[0]}
                    </p>
                  </div>
                  <p className="shrink-0 text-muted-foreground">
                    {l.distanceText} · {l.durationText}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
