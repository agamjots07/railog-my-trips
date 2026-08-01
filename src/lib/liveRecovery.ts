import { supabase } from "@/integrations/supabase/client";
import { haversineKm } from "@/lib/geo";

type LatLng = [number, number];

const KEY = "pencer.liveHeartbeat";
const STALE_MS = 45_000;

export function beat(tripId: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ tripId, ts: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function clearBeat(tripId: string) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    if (JSON.parse(raw)?.tripId === tripId) localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** True when this trip is actively being recorded by an open tab right now. */
export function isRecordingActive(tripId: string) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const v = JSON.parse(raw) as { tripId?: string; ts?: number };
    return v?.tripId === tripId && typeof v.ts === "number" && Date.now() - v.ts < STALE_MS;
  } catch {
    return false;
  }
}

export function parsePath(geom: unknown): LatLng[] {
  if (!Array.isArray(geom)) return [];
  return (geom as unknown[][]).filter(
    (p): p is LatLng =>
      Array.isArray(p) && p.length === 2 && typeof p[0] === "number" && typeof p[1] === "number",
  );
}

export function pathKm(path: LatLng[]) {
  let km = 0;
  for (let i = 1; i < path.length; i++) km += haversineKm(path[i - 1], path[i]);
  return km;
}

/**
 * Close an interrupted recording using only the points already saved to the
 * database. End time is derived from the last saved sync (falls back to now).
 */
export async function finalizeFromSaved(tripId: string) {
  const { data, error } = await supabase
    .from("trips")
    .select("start_time, route_geometry, distance_km, updated_at")
    .eq("id", tripId)
    .maybeSingle();
  if (error) throw error;
  const path = parsePath(data?.route_geometry);
  const km = data?.distance_km ?? pathKm(path);
  const endIso = data?.updated_at ?? new Date().toISOString();
  const hours = data?.start_time
    ? (new Date(endIso).getTime() - new Date(data.start_time).getTime()) / 3_600_000
    : 0;
  const avg = hours > 0 ? km / hours : null;

  const { error: e } = await supabase
    .from("trips")
    .update({
      is_live: false,
      end_time: endIso,
      distance_km: km,
      ...(avg != null ? { avg_speed_kmh: avg } : {}),
    })
    .eq("id", tripId);
  if (e) throw e;
  clearBeat(tripId);
  return { end_time: endIso, distance_km: km };
}
