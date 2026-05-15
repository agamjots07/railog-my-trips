import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { haversineKm } from "@/lib/geo";

type LatLng = [number, number];

const MIN_MOVE_M = 8; // ignore jitter under ~8m
const SAVE_INTERVAL_MS = 10_000;

function distM(a: LatLng, b: LatLng) {
  return haversineKm(a, b) * 1000;
}

function totalKm(path: LatLng[]) {
  let km = 0;
  for (let i = 1; i < path.length; i++) km += haversineKm(path[i - 1], path[i]);
  return km;
}

export function useLiveTracking(opts: {
  tripId: string;
  enabled: boolean;
  initialPath: LatLng[];
}) {
  const { tripId, enabled, initialPath } = opts;
  const [path, setPath] = useState<LatLng[]>(initialPath);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const pathRef = useRef<LatLng[]>(initialPath);
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    pathRef.current = initialPath;
    setPath(initialPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Geolocation not supported on this device");
      return;
    }

    setTracking(true);
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const pt: LatLng = [pos.coords.latitude, pos.coords.longitude];
        const last = pathRef.current[pathRef.current.length - 1];
        if (!last || distM(last, pt) >= MIN_MOVE_M) {
          pathRef.current = [...pathRef.current, pt];
          dirtyRef.current = true;
          setPath(pathRef.current);
        }
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    watchIdRef.current = id;

    saveTimerRef.current = setInterval(async () => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      const snapshot = pathRef.current;
      await supabase
        .from("trips")
        .update({
          route_geometry: snapshot as unknown as never,
          distance_km: totalKm(snapshot),
        })
        .eq("id", tripId);
    }, SAVE_INTERVAL_MS);

    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
      watchIdRef.current = null;
      saveTimerRef.current = null;
      setTracking(false);
    };
  }, [enabled, tripId]);

  const finalize = async () => {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (saveTimerRef.current) clearInterval(saveTimerRef.current);
    watchIdRef.current = null;
    saveTimerRef.current = null;
    setTracking(false);
    const finalPath = pathRef.current;
    const km = totalKm(finalPath);
    const endIso = new Date().toISOString();
    const { error: e } = await supabase
      .from("trips")
      .update({
        route_geometry: finalPath as unknown as never,
        distance_km: km,
        end_time: endIso,
        is_live: false,
      })
      .eq("id", tripId);
    if (e) throw e;
    return { path: finalPath, distance_km: km, end_time: endIso };
  };

  return { path, tracking, error, finalize };
}
