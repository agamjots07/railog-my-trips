import { useEffect, useMemo, useRef, useState } from "react";
import { DARK_STYLE, useGoogleMaps } from "@/lib/useGoogleMaps";

export type LatLng = [number, number];
export type MapStyle = "satellite" | "dark";

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
};

type Props = {
  routes: MapRoute[];
  stops?: MapStop[];
  center?: LatLng;
  zoom?: number;
  fit?: boolean;
  interactive?: boolean;
  style: MapStyle;
  worldCopyJump?: boolean;
  onReady?: () => void;
  onFail?: () => void;
};

/**
 * Google Maps canvas. Fires onFail if google fails to load, so callers can
 * swap to a Leaflet fallback.
 */
export function GoogleMapCanvas({
  routes,
  stops = [],
  center,
  zoom = 4,
  fit = true,
  interactive = true,
  style,
  onReady,
  onFail,
}: Props) {
  const { status, google } = useGoogleMaps();
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const infoRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (status === "failed") onFail?.();
  }, [status, onFail]);

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
      m.addListener("tilesloaded", () => onReady?.());
      setMounted(true);
    } catch {
      onFail?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, google]);

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
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: s.color,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
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
