import { useEffect, useMemo, useRef, useState } from "react";
import { DARK_STYLE, useGoogleMaps } from "@/lib/useGoogleMaps";

export type LatLng = [number, number];
export type MapStyle = "satellite" | "dark" | "road";

export type MapRoute = {
  id: string;
  points: LatLng[];
  color: string;
  dashed?: boolean;
  weight?: number;
  opacity?: number;
  onClick?: () => void;
  popupHtml?: string;
};

export type MapStop = {
  pos: LatLng;
  color: string;
  /** Marker radius in px (default 6). */
  scale?: number;
  /** Renders as an outlined "ghost" marker (used for insert handles). */
  hollow?: boolean;
  draggable?: boolean;
  onDrag?: (p: LatLng) => void;
  onDragEnd?: (p: LatLng) => void;
  onClick?: () => void;
  title?: string;
  zIndex?: number;
};


type Props = {
  routes: MapRoute[];
  stops?: MapStop[];
  /** A single moving marker (playback dot). Updating it never refits bounds. */
  marker?: { pos: LatLng; color: string; scale?: number } | null;
  center?: LatLng;
  zoom?: number;
  fit?: boolean;
  interactive?: boolean;
  style: MapStyle;
  worldCopyJump?: boolean;
  onReady?: () => void;
  onFail?: () => void;
  onMapClick?: (p: LatLng) => void;
};

/**
 * Resolves once every <img> tile inside `node` has fully decoded and the tile
 * count has stopped changing for a few consecutive polls (i.e. the visible map
 * area is completely rendered). Falls back after `timeoutMs`.
 */
export async function waitForTilesLoaded(node: HTMLElement, timeoutMs = 20000): Promise<void> {
  const start = Date.now();
  let stable = 0;
  let lastCount = -1;
  while (Date.now() - start < timeoutMs) {
    const imgs = Array.from(node.querySelectorAll("img")) as HTMLImageElement[];
    const pending = imgs.filter((i) => !(i.complete && i.naturalWidth > 0));
    if (pending.length === 0 && imgs.length > 0 && imgs.length === lastCount) {
      stable += 1;
      if (stable >= 4) return;
    } else {
      stable = 0;
    }
    lastCount = imgs.length;
    await new Promise((r) => setTimeout(r, 250));
  }
}

/**
 * Google Maps canvas. Fires onFail if google fails to load, so callers can
 * swap to a Leaflet fallback.
 */
export function GoogleMapCanvas({
  routes,
  stops = [],
  marker = null,
  center,
  zoom = 4,
  fit = true,
  interactive = true,
  style,
  onReady,
  onFail,
  onMapClick,
}: Props) {
  const { status, google } = useGoogleMaps();
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const markerRef = useRef<any>(null);
  const infoRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;

  useEffect(() => {
    if (status === "failed") onFail?.();
  }, [status, onFail]);

  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  const quietTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Init map once google is ready
  useEffect(() => {
    if (status !== "ready" || !google?.maps || !hostRef.current || mapRef.current) return;
    try {
      const m = new google.maps.Map(hostRef.current, {
        center: { lat: center?.[0] ?? 20, lng: center?.[1] ?? 0 },
        zoom,
        disableDefaultUI: true,
        gestureHandling: interactive ? "greedy" : "none",
        keyboardShortcuts: false,
        clickableIcons: false,
        mapTypeId: style === "satellite" ? "hybrid" : "roadmap",
        styles: style === "dark" ? DARK_STYLE : undefined,
        backgroundColor: "#0a0a0f",
      });
      mapRef.current = m;
      infoRef.current = new google.maps.InfoWindow();
      // Fire onReady only once tile loading + camera movement has settled AND
      // every tile image inside the map host has fully decoded, so screenshots
      // never capture half-loaded tiles.
      const settle = () => {
        if (quietTimer.current) clearTimeout(quietTimer.current);
        quietTimer.current = setTimeout(() => {
          const host = hostRef.current;
          if (!host) return;
          waitForTilesLoaded(host).then(() => readyRef.current?.());
        }, 900);
      };
      m.addListener("tilesloaded", settle);
      m.addListener("idle", settle);
      m.addListener("click", (e: any) => {
        if (!clickRef.current || !e?.latLng) return;
        clickRef.current([e.latLng.lat(), e.latLng.lng()]);
      });
      setMounted(true);
    } catch {
      onFail?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, google]);

  useEffect(() => {
    return () => {
      if (quietTimer.current) clearTimeout(quietTimer.current);
    };
  }, []);

  // React to style toggle
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !google?.maps) return;
    m.setMapTypeId(style === "satellite" ? "hybrid" : "roadmap");
    m.setOptions({ styles: style === "dark" ? DARK_STYLE : undefined });
  }, [style, google]);

  // Draw routes + stops + fit bounds whenever inputs change
  useEffect(() => {
    if (!mounted || !google?.maps || !mapRef.current) return;
    const m = mapRef.current;
    // Clear
    for (const o of overlaysRef.current) o.setMap(null);
    overlaysRef.current = [];

    const bounds = new google.maps.LatLngBounds();

    for (const r of routes) {
      if (r.points.length < 2) continue;
      const path = r.points.map((p) => ({ lat: p[0], lng: p[1] }));
      const opts: any = {
        path,
        strokeColor: r.color,
        strokeOpacity: r.dashed ? 0 : (r.opacity ?? 0.95),
        strokeWeight: r.weight ?? 4,
        map: m,
        clickable: !!(r.onClick || r.popupHtml),
      };
      if (r.dashed) {
        opts.icons = [
          {
            icon: {
              path: "M 0,-1 0,1",
              strokeOpacity: 1,
              strokeColor: r.color,
              strokeWeight: r.weight ?? 4,
              scale: 3,
            },
            offset: "0",
            repeat: "12px",
          },
        ];
      }
      const line = new google.maps.Polyline(opts);
      if (r.onClick || r.popupHtml) {
        line.addListener("click", (e: any) => {
          if (r.popupHtml && infoRef.current) {
            infoRef.current.setContent(r.popupHtml);
            infoRef.current.setPosition(e.latLng);
            infoRef.current.open(m);
          }
          r.onClick?.();
        });
      }
      overlaysRef.current.push(line);
      for (const p of path) bounds.extend(p);
    }

    for (const s of stops) {
      const marker = new google.maps.Marker({
        position: { lat: s.pos[0], lng: s.pos[1] },
        map: m,
        draggable: !!s.draggable,
        cursor: s.draggable ? "grab" : undefined,
        title: s.title,
        zIndex: s.zIndex,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: s.scale ?? 6,
          fillColor: s.hollow ? "#ffffff" : s.color,
          fillOpacity: s.hollow ? 0.55 : 1,
          strokeColor: s.hollow ? s.color : "#ffffff",
          strokeWeight: 2,
        },
      });
      if (s.onDrag) marker.addListener("drag", (e: any) => s.onDrag!([e.latLng.lat(), e.latLng.lng()]));
      if (s.onDragEnd)
        marker.addListener("dragend", (e: any) => s.onDragEnd!([e.latLng.lat(), e.latLng.lng()]));
      if (s.onClick) marker.addListener("click", () => s.onClick!());
      overlaysRef.current.push(marker);
      bounds.extend({ lat: s.pos[0], lng: s.pos[1] });
    }


    if (fit && !bounds.isEmpty()) {
      if (routes.every((r) => r.points.length < 2) && stops.length <= 1) {
        // Single point — just center
        const only = stops[0];
        if (only) {
          m.setCenter({ lat: only.pos[0], lng: only.pos[1] });
          m.setZoom(14);
        }
      } else {
        m.fitBounds(bounds, 40);
      }
    }
  }, [mounted, routes, stops, fit, google]);

  return <div ref={hostRef} className="h-full w-full" style={{ background: "#0a0a0f" }} />;
}

// Convenience hook for callers to decide provider.
export function useMapProvider() {
  const { status } = useGoogleMaps();
  const [forcedLeaflet, setForced] = useState(false);
  const provider: "google" | "leaflet" = useMemo(() => {
    if (forcedLeaflet) return "leaflet";
    if (status === "failed") return "leaflet";
    return "google";
  }, [status, forcedLeaflet]);
  return { provider, googleStatus: status, forceLeaflet: () => setForced(true) };
}
