// Station search + route geometry, backed by the in-database GTFS tables
// (GO Transit + TTC). Kept under the existing filename / export names so the
// rest of the app keeps working without changes.

import { supabase } from "@/integrations/supabase/client";

export type LatLng = [number, number];

export type StationHit = {
  id: string;            // "{agency_id}:{stop_id}"
  name: string;
  label: string;
  lat: number;
  lng: number;
  kind: string;          // human label, e.g. "Train station · GO Transit"
};

const AGENCY_LABEL: Record<string, string> = {
  go: "GO Transit",
  ttc: "TTC",
  lvm: "Las Vegas Monorail",
  vmr: "Valley Metro Rail",
  tif: "Toronto Island Ferry",
  bcf: "BC Ferries",
};

const MODE_KIND: Record<string, string> = {
  train: "Train station",
  subway: "Subway station",
  tram: "Light rail stop",
  monorail: "Monorail station",
  ferry: "Ferry terminal",
  bus: "Bus stop",
};

// Which GTFS `mode` values should be returned for each UI mode.
const MODE_FILTER: Record<"train" | "ferry", string[]> = {
  train: ["train", "subway", "tram", "monorail"],
  ferry: ["ferry"],
};

export async function searchStations(
  query: string,
  mode: "train" | "ferry",
  limit = 8,
): Promise<StationHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const modes = MODE_FILTER[mode];

  const { data, error } = await supabase
    .from("gtfs_stops")
    .select("id, agency_id, name, lat, lng, mode")
    .in("mode", modes)
    .ilike("name", `%${q}%`)
    .limit(limit * 4); // grab extras so dedupe can work

  if (error || !data) return [];

  // De-duplicate by (name + agency) — GTFS often has multiple platform-level
  // stops for the same station. Prefer the first encountered.
  const seen = new Map<string, StationHit>();
  for (const s of data) {
    const key = `${s.agency_id}:${s.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    const agency = AGENCY_LABEL[s.agency_id] ?? s.agency_id;
    const kind = MODE_KIND[s.mode] ?? "Stop";
    seen.set(key, {
      id: s.id,
      name: s.name,
      label: `${s.name} · ${agency}`,
      lat: s.lat,
      lng: s.lng,
      kind: `${kind} · ${agency}`,
    });
    if (seen.size >= limit) break;
  }
  return Array.from(seen.values());
}

/**
 * Find a real GTFS route shape whose polyline passes near both stations and
 * return the section between them. Falls back to `null` if nothing matches —
 * the caller then draws a straight line.
 */
export async function fetchRouteGeometry(
  origin: StationHit,
  destination: StationHit,
  mode: "train" | "ferry",
): Promise<LatLng[] | null> {
  const modes = MODE_FILTER[mode];
  const { data, error } = await supabase.rpc("gtfs_shapes_near", {
    o_lat: origin.lat,
    o_lng: origin.lng,
    d_lat: destination.lat,
    d_lng: destination.lng,
    pad: 0.03,
    modes,
  });
  if (error || !data?.length) return null;

  // ~0.005° ≈ 500m — each endpoint must lie close to the shape.
  const MAX_ENDPOINT_DIST_SQ = 0.005 * 0.005;
  let best: { coords: LatLng[]; score: number } | null = null;

  for (const row of data as Array<{ geometry: unknown }>) {
    const geom = row.geometry as LatLng[] | null;
    if (!Array.isArray(geom) || geom.length < 2) continue;
    const trimmed = trimBetween(geom, [origin.lat, origin.lng], [destination.lat, destination.lng]);
    if (trimmed.length < 2) continue;
    const dStart = distSq(trimmed[0], [origin.lat, origin.lng]);
    const dEnd = distSq(trimmed[trimmed.length - 1], [destination.lat, destination.lng]);
    if (dStart > MAX_ENDPOINT_DIST_SQ || dEnd > MAX_ENDPOINT_DIST_SQ) continue;
    const score = dStart + dEnd + trimmed.length * 1e-9; // tiebreak: shorter wins
    if (!best || score < best.score) best = { coords: trimmed, score };
  }

  return best?.coords ?? null;
}

function distSq(a: LatLng, b: LatLng) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

function trimBetween(path: LatLng[], a: LatLng, b: LatLng): LatLng[] {
  let ai = 0;
  let bi = 0;
  let aBest = Infinity;
  let bBest = Infinity;
  for (let i = 0; i < path.length; i++) {
    const da = distSq(path[i], a);
    const db = distSq(path[i], b);
    if (da < aBest) { aBest = da; ai = i; }
    if (db < bBest) { bBest = db; bi = i; }
  }
  const [start, end] = ai <= bi ? [ai, bi] : [bi, ai];
  const slice = path.slice(start, end + 1);
  return ai <= bi ? slice : slice.reverse();
}
