import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { toPng } from "html-to-image";
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import { Download, Share2, X, MapPin, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { MODE_COLOR, MODE_ICON, MODE_LABEL, type TripMode } from "@/lib/modes";
import { fmtDate, fmtDuration } from "@/lib/geo";
import { reverseGeocode } from "@/lib/reverseGeocode";
import { toast } from "sonner";

type Trip = Tables<"trips">;
type Vehicle = Tables<"vehicles">;
type LatLng = [number, number];

function isPlaceholder(s: string | null | undefined) {
  if (!s) return true;
  const t = s.trim().toLowerCase();
  return t === "" || t === "live" || t === "live start" || t === "live end" || t.startsWith("live ");
}

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])));
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [points, map]);
  return null;
}

function MapReady({ onReady }: { onReady: () => void }) {
  const map = useMap();
  useEffect(() => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      // give tiles a final paint frame
      setTimeout(onReady, 350);
    };
    map.whenReady(() => {
      // Wait for tile layers to load
      let pending = 0;
      map.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) {
          pending++;
          layer.once("load", () => {
            pending--;
            if (pending <= 0) finish();
          });
        }
      });
      if (pending === 0) finish();
    });
    // Safety fallback
    const t = setTimeout(finish, 3500);
    return () => clearTimeout(t);
  }, [map, onReady]);
  return null;
}

export function ShareTripCard({
  trip,
  path,
  vehicle,
  onClose,
}: {
  trip: Trip;
  path: LatLng[];
  vehicle?: Vehicle | null;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [originLabel, setOriginLabel] = useState<string | null>(null);
  const [destLabel, setDestLabel] = useState<string | null>(null);

  const mode = trip.mode as TripMode;
  const Icon = MODE_ICON[mode] ?? MODE_ICON.train;
  const color = MODE_COLOR[mode] ?? MODE_COLOR.train;

  // Title: vehicle name for taxi, else route_name or origin → destination
  const title = useMemo(() => {
    if (mode === "taxi") {
      if (vehicle?.name) return vehicle.name;
      return MODE_LABEL.taxi;
    }
    if (trip.route_name) return trip.route_name;
    return `${trip.origin} → ${trip.destination}`;
  }, [mode, vehicle?.name, trip.route_name, trip.origin, trip.destination]);

  const distance = trip.distance_km
    ? `${trip.distance_km.toFixed(trip.distance_km < 10 ? 1 : 0)}`
    : "—";
  const duration = fmtDuration(trip.start_time, trip.end_time);

  const stops: LatLng[] = [
    trip.origin_lat != null && trip.origin_lng != null
      ? ([trip.origin_lat, trip.origin_lng] as LatLng)
      : null,
    trip.destination_lat != null && trip.destination_lng != null
      ? ([trip.destination_lat, trip.destination_lng] as LatLng)
      : null,
  ].filter(Boolean) as LatLng[];
  const routeLine = path && path.length >= 2 ? path : null;
  const fitPoints: LatLng[] = routeLine ?? stops;
  const dashed = mode === "ferry" || mode === "jetski";

  // Resolve place names for start/end. Use real trip.origin / trip.destination
  // when they aren't placeholder "Live …" strings; otherwise reverse-geocode
  // from the path or stop coordinates.
  useEffect(() => {
    let cancelled = false;
    const startPt: LatLng | null =
      (path && path[0]) ??
      (trip.origin_lat != null && trip.origin_lng != null
        ? [trip.origin_lat, trip.origin_lng]
        : null);
    const endPt: LatLng | null =
      (path && path.length > 1 ? path[path.length - 1] : null) ??
      (trip.destination_lat != null && trip.destination_lng != null
        ? [trip.destination_lat, trip.destination_lng]
        : null);

    if (!isPlaceholder(trip.origin)) {
      setOriginLabel(trip.origin);
    } else if (startPt) {
      reverseGeocode(startPt).then((l) => {
        if (!cancelled) setOriginLabel(l ?? "Start");
      });
    } else {
      setOriginLabel("Start");
    }

    if (!isPlaceholder(trip.destination)) {
      setDestLabel(trip.destination);
    } else if (endPt) {
      reverseGeocode(endPt).then((l) => {
        if (!cancelled) setDestLabel(l ?? "End");
      });
    } else {
      setDestLabel("End");
    }
    return () => {
      cancelled = true;
    };
  }, [trip.origin, trip.destination, trip.origin_lat, trip.origin_lng, trip.destination_lat, trip.destination_lng, path]);

  const generate = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    const dataUrl = await toPng(cardRef.current, {
      pixelRatio: 3,
      cacheBust: true,
      backgroundColor: "#0a0a0f",
    });
    const res = await fetch(dataUrl);
    return await res.blob();
  };

  const filename = `railog-${(trip.route_name || trip.id)
    .toString()
    .replace(/\s+/g, "-")
    .toLowerCase()}.png`;

  const download = async () => {
    try {
      setBusy(true);
      const blob = await generate();
      if (!blob) return;
      const file = new File([blob], filename, { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };
      // iOS / mobile: use Web Share to access "Save Image" → Photos
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: "Railog", text: title });
        return;
      }
      // Desktop / fallback: download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Saved to downloads");
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        toast.error("Couldn't save image");
        console.error(e);
      }
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    try {
      setBusy(true);
      const blob = await generate();
      if (!blob) return;
      const file = new File([blob], filename, { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({
          files: [file],
          title: "Railog",
          text: `${title} — ${distance} km on Railog`,
        });
      } else {
        // Open in new tab so user can long-press → Save Image
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        toast.error("Couldn't share");
      }
    } finally {
      setBusy(false);
    }
  };

  const overlay = (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[2147483000] flex flex-col bg-background/95 backdrop-blur-lg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),1rem)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Share trip
          </p>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.06] bg-card/60 text-muted-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-y-auto px-5 py-4">
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 240, damping: 22 }}
            className="w-full max-w-sm"
          >
            <div
              ref={cardRef}
              className="relative overflow-hidden rounded-[28px] p-6 text-white"
              style={{
                background:
                  "linear-gradient(155deg, #14141d 0%, #0a0a0f 60%, #0a0a0f 100%)",
                boxShadow: `0 30px 80px -20px ${color}66, 0 0 0 1px rgba(255,255,255,0.06) inset`,
              }}
            >
              <div
                className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full opacity-40 blur-3xl"
                style={{ background: color }}
              />

              {/* Header */}
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-white/80" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/70">
                    Railog
                  </p>
                </div>
                <div
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: `${color}25`, color }}
                >
                  <Icon className="h-3 w-3" strokeWidth={3} />
                  {MODE_LABEL[mode] ?? mode}
                </div>
              </div>

              <h2 className="relative mt-4 text-[22px] font-bold leading-tight tracking-tight">
                {title}
              </h2>
              <div className="relative mt-1 flex items-center gap-1.5 text-xs text-white/60">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{originLabel ?? "…"}</span>
                <span>→</span>
                <span className="truncate">{destLabel ?? "…"}</span>
              </div>

              {/* Real map */}
              <div
                className="relative mt-5 overflow-hidden rounded-2xl"
                style={{
                  height: 180,
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "#0f0f17",
                }}
              >
                {fitPoints.length > 0 ? (
                  <MapContainer
                    center={fitPoints[0]}
                    zoom={12}
                    zoomControl={false}
                    attributionControl={false}
                    scrollWheelZoom={false}
                    dragging={false}
                    doubleClickZoom={false}
                    touchZoom={false}
                    boxZoom={false}
                    keyboard={false}
                    style={{ height: "100%", width: "100%", background: "#0f0f17" }}
                  >
                    <TileLayer
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      maxZoom={19}
                      crossOrigin="anonymous"
                    />
                    {routeLine && (
                      <Polyline
                        positions={routeLine}
                        pathOptions={{
                          color,
                          weight: 4,
                          opacity: 0.95,
                          dashArray: dashed ? "8 6" : undefined,
                          lineCap: "round",
                          lineJoin: "round",
                        }}
                      />
                    )}
                    {!routeLine && stops.length === 2 && (
                      <Polyline
                        positions={stops}
                        pathOptions={{ color, weight: 3, opacity: 0.6, dashArray: "4 6" }}
                      />
                    )}
                    {stops.map((p, i) => (
                      <CircleMarker
                        key={i}
                        center={p}
                        radius={6}
                        pathOptions={{ color, fillColor: color, fillOpacity: 1, weight: 2 }}
                      />
                    ))}
                    <FitBounds points={fitPoints} />
                    <MapReady onReady={() => setMapReady(true)} />
                  </MapContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-[11px] uppercase tracking-wider text-white/40">
                    No route geometry
                  </div>
                )}
                {!mapReady && fitPoints.length > 0 && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0f0f17]/60">
                    <Loader2 className="h-4 w-4 animate-spin text-white/60" />
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="relative mt-5 grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/50">
                    Distance
                  </p>
                  <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums">
                    {distance}
                    <span className="ml-1 text-xs font-semibold text-white/50">km</span>
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/50">
                    Duration
                  </p>
                  <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums">
                    {duration}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/50">
                    Date
                  </p>
                  <p className="mt-1.5 font-mono text-sm font-bold tabular-nums leading-tight pt-2">
                    {fmtDate(trip.start_time)}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-2 gap-3 px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-4">
          <button
            onClick={download}
            disabled={busy || (!mapReady && fitPoints.length > 0)}
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-card py-3.5 text-sm font-bold transition active:scale-[0.98] disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Save image
          </button>
          <button
            onClick={share}
            disabled={busy || (!mapReady && fitPoints.length > 0)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground transition active:scale-[0.98] disabled:opacity-50"
            style={{ boxShadow: "var(--shadow-glow)" }}
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );

  if (typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}
