import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { haversineKm } from "@/lib/geo";
import { reverseGeocode } from "@/lib/reverseGeocode";

type LatLng = [number, number];

const MIN_MOVE_M = 8; // ignore jitter under ~8m
const SAVE_INTERVAL_MS = 10_000;
// After resume, we require this many stable fixes before recording again.
// A "stable" fix is one with reasonable accuracy — this prevents the first
// post-resume reading (often a cold-start GPS spike) from creating a fake
// speed or teleporting the route across the pause gap.
const RESUME_WARMUP_FIXES = 2;
const RESUME_ACCURACY_M = 50;

function distM(a: LatLng, b: LatLng) {
  return haversineKm(a, b) * 1000;
}

function totalKm(path: LatLng[]) {
  let km = 0;
  for (let i = 1; i < path.length; i++) km += haversineKm(path[i - 1], path[i]);
  return km;
}

type WakeLockSentinelLike = { released: boolean; release: () => Promise<void> };

export function useLiveTracking(opts: {
  tripId: string;
  enabled: boolean;
  initialPath: LatLng[];
}) {
  const { tripId, enabled, initialPath } = opts;
  const [path, setPath] = useState<LatLng[]>(initialPath);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const [speedKmh, setSpeedKmh] = useState<number | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pausedMs, setPausedMs] = useState(0);
  const [warmingUp, setWarmingUp] = useState(false);
  const [distanceKm, setDistanceKm] = useState<number>(totalKm(initialPath));

  const watchIdRef = useRef<number | null>(null);
  const pathRef = useRef<LatLng[]>(initialPath);
  const distanceKmRef = useRef<number>(totalKm(initialPath));
  const lastFixTimeRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const maxSpeedRef = useRef<number>(0);
  const startedAtRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const pauseStartRef = useRef<number | null>(null);
  const pausedMsRef = useRef(0);
  const pausedTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const warmupRef = useRef(0);
  const skipNextDistanceRef = useRef(false);

  useEffect(() => {
    pathRef.current = initialPath;
    distanceKmRef.current = totalKm(initialPath);
    setPath(initialPath);
    setDistanceKm(distanceKmRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  // Screen wake lock — keep phone awake while recording
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> };
    };
    if (!nav.wakeLock?.request) return;

    const acquire = async () => {
      try {
        const sentinel = await nav.wakeLock!.request("screen");
        if (cancelled) {
          sentinel.release().catch(() => {});
          return;
        }
        wakeLockRef.current = sentinel;
        setWakeLockActive(true);
        (sentinel as unknown as EventTarget).addEventListener?.("release", () => {
          setWakeLockActive(false);
        });
      } catch {
        setWakeLockActive(false);
      }
    };
    acquire();

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (!wakeLockRef.current || wakeLockRef.current.released) acquire();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      const s = wakeLockRef.current;
      wakeLockRef.current = null;
      setWakeLockActive(false);
      if (s && !s.released) s.release().catch(() => {});
    };
  }, [enabled]);

  const handleFix = (pos: GeolocationPosition) => {
    if (pausedRef.current) return;
    const pt: LatLng = [pos.coords.latitude, pos.coords.longitude];
    const now = pos.timestamp || Date.now();
    const acc = typeof pos.coords.accuracy === "number" ? pos.coords.accuracy : 9999;

    // Warmup after resume: drop fixes until we get stable ones.
    if (warmupRef.current > 0) {
      if (acc <= RESUME_ACCURACY_M) {
        warmupRef.current -= 1;
        if (warmupRef.current === 0) setWarmingUp(false);
      }
      lastFixTimeRef.current = now; // reset so speed isn't derived across gap
      return;
    }

    const last = pathRef.current[pathRef.current.length - 1];
    // speed: prefer device-provided (m/s), fall back to derived
    let s: number | null = null;
    if (typeof pos.coords.speed === "number" && pos.coords.speed >= 0) {
      s = pos.coords.speed * 3.6;
    } else if (last && lastFixTimeRef.current) {
      const dt = (now - lastFixTimeRef.current) / 1000;
      if (dt > 0) s = (distM(last, pt) / dt) * 3.6;
    }
    if (s != null) {
      if (s > 200) {
        s = null;
      } else {
        setSpeedKmh(s);
        if (s > maxSpeedRef.current) maxSpeedRef.current = s;
      }
    }
    lastFixTimeRef.current = now;
    if (!last || distM(last, pt) >= MIN_MOVE_M) {
      // On the first fix after resume, append the point but don't count
      // the gap distance from the pre-pause last point.
      if (last && !skipNextDistanceRef.current) {
        distanceKmRef.current += haversineKm(last, pt);
      }
      skipNextDistanceRef.current = false;
      pathRef.current = [...pathRef.current, pt];
      dirtyRef.current = true;
      setPath(pathRef.current);
      setDistanceKm(distanceKmRef.current);
    }
  };

  const startWatch = () => {
    if (watchIdRef.current != null) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      handleFix,
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    watchIdRef.current = id;
  };

  const stopWatch = () => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Geolocation not supported on this device");
      return;
    }

    setTracking(true);
    if (startedAtRef.current == null) startedAtRef.current = Date.now();
    if (!pausedRef.current) startWatch();

    saveTimerRef.current = setInterval(async () => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      const snapshot = pathRef.current;
      await supabase
        .from("trips")
        .update({
          route_geometry: snapshot as unknown as never,
          distance_km: distanceKmRef.current,
        })
        .eq("id", tripId);
    }, SAVE_INTERVAL_MS);

    return () => {
      stopWatch();
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
      saveTimerRef.current = null;
      setTracking(false);
      setSpeedKmh(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tripId]);

  const pause = () => {
    if (pausedRef.current || !enabled) return;
    pausedRef.current = true;
    setPaused(true);
    pauseStartRef.current = Date.now();
    stopWatch();
    setSpeedKmh(null);
    // Tick pausedMs live so UI can subtract it from duration display.
    pausedTickRef.current = setInterval(() => {
      if (pauseStartRef.current != null) {
        setPausedMs(pausedMsRef.current + (Date.now() - pauseStartRef.current));
      }
    }, 1000);
  };

  const resume = () => {
    if (!pausedRef.current) return;
    if (pauseStartRef.current != null) {
      pausedMsRef.current += Date.now() - pauseStartRef.current;
      pauseStartRef.current = null;
    }
    setPausedMs(pausedMsRef.current);
    if (pausedTickRef.current) {
      clearInterval(pausedTickRef.current);
      pausedTickRef.current = null;
    }
    pausedRef.current = false;
    setPaused(false);
    warmupRef.current = RESUME_WARMUP_FIXES;
    setWarmingUp(true);
    lastFixTimeRef.current = null;
    skipNextDistanceRef.current = true;
    startWatch();
  };

  const togglePause = () => (pausedRef.current ? resume() : pause());

  const finalize = async () => {
    // If ending while paused, count the current pause up until now.
    if (pausedRef.current && pauseStartRef.current != null) {
      pausedMsRef.current += Date.now() - pauseStartRef.current;
      pauseStartRef.current = null;
    }
    if (pausedTickRef.current) {
      clearInterval(pausedTickRef.current);
      pausedTickRef.current = null;
    }
    stopWatch();
    if (saveTimerRef.current) clearInterval(saveTimerRef.current);
    saveTimerRef.current = null;
    setTracking(false);
    setSpeedKmh(null);
    setPaused(false);
    pausedRef.current = false;

    const s = wakeLockRef.current;
    wakeLockRef.current = null;
    setWakeLockActive(false);
    if (s && !s.released) s.release().catch(() => {});

    const finalPath = pathRef.current;
    const km = distanceKmRef.current;
    // Exclude paused time from the recorded duration by shifting end_time back.
    const endMs = Date.now() - pausedMsRef.current;
    const endIso = new Date(endMs).toISOString();

    const { data: existing } = await supabase
      .from("trips")
      .select("start_time")
      .eq("id", tripId)
      .maybeSingle();
    const startMs = existing?.start_time
      ? new Date(existing.start_time).getTime()
      : startedAtRef.current ?? Date.now();
    const hours = Math.max(0, (endMs - startMs) / 3_600_000);
    const avg = hours > 0 ? km / hours : null;
    const maxS = maxSpeedRef.current > 0 ? maxSpeedRef.current : null;

    let originLabel: string | null = null;
    let destLabel: string | null = null;
    if (finalPath.length > 0) {
      const first = finalPath[0];
      const last = finalPath[finalPath.length - 1];
      try {
        originLabel = await reverseGeocode(first);
      } catch { /* ignore */ }
      try {
        destLabel = await reverseGeocode(last);
      } catch { /* ignore */ }
    }

    const patch = {
      route_geometry: finalPath as unknown as never,
      distance_km: km,
      end_time: endIso,
      is_live: false,
      avg_speed_kmh: avg,
      max_speed_kmh: maxS,
      ...(originLabel ? { origin: originLabel } : {}),
      ...(destLabel ? { destination: destLabel } : {}),
    };

    const { error: e } = await supabase.from("trips").update(patch).eq("id", tripId);
    if (e) throw e;
    return { path: finalPath, distance_km: km, end_time: endIso };
  };

  return {
    path,
    tracking,
    error,
    finalize,
    speedKmh,
    wakeLockActive,
    paused,
    pausedMs,
    warmingUp,
    distanceKm,
    togglePause,
  };
}
