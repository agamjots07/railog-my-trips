import { useEffect, useState } from "react";


export type GMapsStatus = "loading" | "ready" | "failed";

type GAny = typeof globalThis & {
  google?: any;
  __gmapsInitCb?: () => void;
  gm_authFailure?: () => void;
};

let cached: Promise<any> | null = null;
let currentStatus: GMapsStatus = "loading";
const listeners = new Set<(s: GMapsStatus) => void>();

function setStatus(s: GMapsStatus) {
  currentStatus = s;
  listeners.forEach((cb) => cb(s));
}

/**
 * Force Google Maps into failed state so the app switches to Leaflet.
 * Called on quota errors, auth failures, or manual detection.
 */
export function failGoogleMaps() {
  setStatus("failed");
}

function loadOnce(): Promise<any> {
  if (cached) return cached;
  cached = (async () => {
    try {
      if (typeof window === "undefined") throw new Error("ssr");
      const g = window as GAny;
      if (g.google?.maps) {
        setStatus("ready");
        return g.google;
      }
      const { key } = await getGoogleMapsKey();
      if (!key) throw new Error("no key");
      // Google calls this on any auth/referrer/quota failure.
      g.gm_authFailure = () => setStatus("failed");
      await new Promise<void>((resolve, reject) => {
        g.__gmapsInitCb = () => resolve();
        const s = document.createElement("script");
        s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
          key,
        )}&loading=async&callback=__gmapsInitCb&v=weekly`;
        s.async = true;
        s.defer = true;
        s.onerror = () => reject(new Error("script load failed"));
        document.head.appendChild(s);
      });
      if (!g.google?.maps) throw new Error("google.maps missing");
      setStatus("ready");
      return g.google;
    } catch {
      setStatus("failed");
      return null;
    }
  })();
  return cached;
}

export function useGoogleMaps() {
  const [status, setLocal] = useState<GMapsStatus>(currentStatus);
  useEffect(() => {
    listeners.add(setLocal);
    setLocal(currentStatus);
    loadOnce();
    return () => {
      listeners.delete(setLocal);
    };
  }, []);
  const g = typeof window !== "undefined" ? (window as GAny).google : null;
  return { status, google: g };
}

// Minimal dark map style (Snazzy-inspired). Used for the "dark" toggle.
export const DARK_STYLE: any[] = [
  { elementType: "geometry", stylers: [{ color: "#0f1419" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f1419" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8b98a5" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d8dee9" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#8b98a5" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1a2a2a" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e2a35" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#151d24" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#7a8794" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2a3947" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#1e2a35" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a1520" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4a5a6b" }] },
];
