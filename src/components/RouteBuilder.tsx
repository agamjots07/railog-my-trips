import { useMemo, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { supabase } from "@/integrations/supabase/client";
import { GoogleMapCanvas, useMapProvider } from "@/components/GoogleMapCanvas";
import { MapStyleToggle, type MapStyle } from "@/components/MapStyleToggle";
import { MODE_COLOR, type TripMode } from "@/lib/modes";
import { haversineKm } from "@/lib/geo";
import { X, Undo2, Trash2, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

type LatLng = [number, number];

function totalKm(path: LatLng[]) {
  let km = 0;
  for (let i = 1; i < path.length; i++) km += haversineKm(path[i - 1], path[i]);
  return km;
}

function midpoint(a: LatLng, b: LatLng): LatLng {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function dotIcon(color: string, size: number, hollow: boolean) {
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${
      hollow ? "rgba(255,255,255,0.55)" : color
    };border:2px solid ${hollow ? color : "#fff"};box-sizing:border-box"></div>`,
  });
}

function LeafletClicks({ onAdd }: { onAdd: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onAdd([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}


export function RouteBuilder({
  tripId,
  mode,
  center,
  initialPath = [],
  initialTopSpeed,
  onClose,
  onSaved,
}: {
  tripId: string;
  mode: TripMode;
  center?: LatLng | null;
  initialPath?: LatLng[];
  initialTopSpeed?: number | null;
  onClose: () => void;
  onSaved: (v: { path: LatLng[]; distanceKm: number; maxSpeed: number | null }) => void;
}) {
  const [points, setPoints] = useState<LatLng[]>(initialPath);
  const [selected, setSelected] = useState<number | null>(null);
  const [topSpeed, setTopSpeed] = useState<string>(
    initialTopSpeed != null ? String(Math.round(initialTopSpeed)) : "",
  );
  const [style, setStyle] = useState<MapStyle>("satellite");
  const [saving, setSaving] = useState(false);
  const { provider, forceLeaflet } = useMapProvider();

  const color = MODE_COLOR[mode] ?? MODE_COLOR.train;
  const km = useMemo(() => totalKm(points), [points]);
  const start: LatLng = center ?? points[0] ?? [36.1699, -115.1398];

  const add = (p: LatLng) => {
    setPoints((prev) => [...prev, p]);
    setSelected(null);
  };
  const movePoint = (i: number, p: LatLng) =>
    setPoints((prev) => prev.map((q, j) => (j === i ? p : q)));
  const insertAt = (i: number, p: LatLng) => {
    setPoints((prev) => [...prev.slice(0, i), p, ...prev.slice(i)]);
    setSelected(i);
  };
  const removeAt = (i: number) => {
    setPoints((prev) => prev.filter((_, j) => j !== i));
    setSelected(null);
  };

  // Draggable waypoint handles + hollow "insert" handles at each segment midpoint.
  const stops = useMemo(() => {
    const out = points.map((p, i) => ({
      pos: p,
      color,
      scale: selected === i ? 9 : 7,
      draggable: true,
      zIndex: 20,
      title: `Waypoint ${i + 1}`,
      onDragEnd: (np: LatLng) => movePoint(i, np),
      onClick: () => setSelected((s) => (s === i ? null : i)),
    }));
    const mids = points.slice(1).map((p, i) => ({
      pos: midpoint(points[i], p),
      color,
      scale: 5,
      hollow: true,
      draggable: true,
      zIndex: 10,
      title: "Drag or tap to insert a waypoint here",
      onDragEnd: (np: LatLng) => insertAt(i + 1, np),
      onClick: () => insertAt(i + 1, midpoint(points[i], p)),
    }));
    return [...mids, ...out];
  }, [points, color, selected]);


  const save = async () => {
    if (points.length < 2) {
      toast.error("Drop at least two waypoints");
      return;
    }
    setSaving(true);
    const parsed = topSpeed.trim() === "" ? null : Number(topSpeed);
    const maxSpeed =
      parsed != null && Number.isFinite(parsed) && parsed > 0 && parsed <= 400 ? parsed : null;
    const distanceKm = totalKm(points);
    const { error } = await supabase
      .from("trips")
      .update({
        route_geometry: points as unknown as never,
        distance_km: distanceKm,
        ...(maxSpeed != null ? { max_speed_kmh: maxSpeed } : {}),
      })
      .eq("id", tripId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Route saved");
    onSaved({ path: points, distanceKm, maxSpeed });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-background">
      <div
        className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 pb-3"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.06] bg-card/60 text-muted-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Trace route
        </p>
        <button
          onClick={save}
          disabled={saving || points.length < 2}
          className="flex h-9 items-center justify-center gap-1.5 rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground transition active:scale-[0.98] disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Done
        </button>
      </div>

      <div className="relative min-h-[35vh] flex-1">
        {provider === "google" ? (
          <GoogleMapCanvas
            style={style}
            onFail={forceLeaflet}
            onMapClick={add}
            fit={false}
            center={start}
            zoom={points.length > 1 ? 8 : 9}
            routes={points.length > 1 ? [{ id: "draft", points, color, weight: 4 }] : []}
            stops={points.map((p) => ({ pos: p, color }))}
          />
        ) : (
          <MapContainer center={start} zoom={9} style={{ height: "100%", width: "100%" }}>
            {style === "satellite" ? (
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="Tiles &copy; Esri"
                maxZoom={19}
              />
            ) : style === "road" ? (
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
                attribution="&copy; OpenStreetMap &copy; CARTO"
                maxZoom={19}
              />
            ) : (
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
                attribution="&copy; OpenStreetMap &copy; CARTO"
                maxZoom={19}
              />
            )}
            <LeafletClicks onAdd={add} />
            {points.length > 1 && (
              <Polyline positions={points} pathOptions={{ color, weight: 4, opacity: 0.95 }} />
            )}
            {points.map((p, i) => (
              <CircleMarker
                key={i}
                center={p}
                radius={6}
                pathOptions={{ color, fillColor: color, fillOpacity: 1, weight: 2 }}
              />
            ))}
          </MapContainer>
        )}
        <div className="absolute right-3 top-3 z-[400]">
          <MapStyleToggle value={style} onChange={setStyle} />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <span className="rounded-full bg-background/80 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground backdrop-blur">
            Tap the map to drop waypoints along your path
          </span>
        </div>
      </div>

      <div
        className="max-h-[55vh] shrink-0 space-y-3 overflow-y-auto border-t border-white/[0.06] bg-card px-4 pt-4"
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Waypoints
            </p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums">{points.length}</p>
          </div>
          <div className="flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Distance
            </p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums">{km.toFixed(1)} km</p>
          </div>
          <button
            onClick={() => setPoints((p) => p.slice(0, -1))}
            disabled={points.length === 0}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.08] bg-background text-muted-foreground disabled:opacity-40"
            aria-label="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setPoints([])}
            disabled={points.length === 0}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.08] bg-background text-muted-foreground disabled:opacity-40"
            aria-label="Clear"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <label className="block">
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Top speed (km/h, optional)
          </span>
          <input
            value={topSpeed}
            onChange={(e) => setTopSpeed(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            placeholder="e.g. 110"
            className="mt-1.5 w-full rounded-2xl border border-white/[0.08] bg-background px-4 py-3 font-mono text-sm outline-none focus:border-primary/60"
          />
        </label>
      </div>
    </div>
  );
}
