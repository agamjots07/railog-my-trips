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
      const key = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? "";
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

/**
 * Premium Google-native dark map style. Full-coverage feature list so no
 * default light surfaces bleed through (POIs, landscape, transit, admin).
 */
export const DARK_STYLE: any[] = [
  { elementType: "geometry", stylers: [{ color: "#0b0f14" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8792a2" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b0f14" }] },

  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#1b2530" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#9aa7b5" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#dbe3ec" }] },
  { featureType: "administrative.neighborhood", elementType: "labels.text.fill", stylers: [{ color: "#6f7c8b" }] },

  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#0e141b" }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#101821" }] },

  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#121a22" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#6f7c8b" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#122019" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#5c7a68" }] },

  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a232d" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#12191f" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#7c8896" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#212d39" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2b3a49" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#16202a" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#b7c2cf" }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#161f28" }] },
  { featureType: "road.local", elementType: "labels", stylers: [{ visibility: "simplified" }] },

  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#182029" }] },
  { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#22303c" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#8792a2" }] },

  { featureType: "water", elementType: "geometry", stylers: [{ color: "#070d14" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3f5163" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#070d14" }] },
];
