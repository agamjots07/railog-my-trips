// Transitland v2 REST API helpers.
// Used for station autocomplete and actual route geometry.

const API_KEY = "zD6WSpWt8DetvF1CeEjXnjYhEaJAz8Vh";
const BASE = "https://transit.land/api/v2/rest";

export type LatLng = [number, number];

export type StationHit = {
  id: string; // Transitland onestop_id, e.g. "s-9q8yyk8yvv-stop"
  name: string;
  label: string;
  lat: number;
  lng: number;
  kind: string;
};

// GTFS route_type codes
const TRAIN_TYPES = [2, 1, 0, 5, 7, 12]; // rail, subway, tram, cable tram, funicular, monorail
const FERRY_TYPES = [4];

function kindLabel(routeType: number | undefined, mode: "train" | "ferry"): string {
  if (mode === "ferry") return "Ferry terminal";
  switch (routeType) {
    case 0: return "Tram stop";
    case 1: return "Metro station";
    case 2: return "Train station";
    case 5: return "Cable tram stop";
    case 7: return "Funicular station";
    case 12: return "Monorail station";
    default: return "Station";
  }
}

async function tlGet(path: string, params: Record<string, string | number>): Promise<any> {
  const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), apikey: API_KEY });
  const res = await fetch(`${BASE}/${path}?${qs.toString()}`);
  if (!res.ok) throw new Error(`Transitland ${res.status}`);
  return res.json();
}

/** Search stops/terminals matching `query` for the given mode. */
export async function searchStations(
  query: string,
  mode: "train" | "ferry",
  limit = 8,
): Promise<StationHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const types = mode === "ferry" ? FERRY_TYPES : TRAIN_TYPES;

  // Run a request per route_type in parallel and merge results.
  const results = await Promise.allSettled(
    types.map((t) =>
      tlGet("stops", { search: q, served_by_route_type: t, limit }),
    ),
  );

  const seen = new Map<string, StationHit>();
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const stops: any[] = r.value?.stops ?? [];
    for (const s of stops) {
      const id = s.onestop_id as string;
      if (!id || seen.has(id)) continue;
      const coords = s.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) continue;
      const lng = coords[0];
      const lat = coords[1];
      const name: string = s.stop_name ?? "Unnamed";
      const agency: string =
        s.route_stops?.[0]?.agency?.agency_name ??
        s.route_stops?.[0]?.route?.agency?.agency_name ??
        "";
      const routeType: number | undefined = s.route_stops?.[0]?.route?.route_type;
      seen.set(id, {
        id,
        name,
        label: agency ? `${name} · ${agency}` : name,
        lat,
        lng,
        kind: kindLabel(routeType, mode),
      });
    }
  }

  return Array.from(seen.values()).slice(0, limit);
}

/**
 * Fetch route geometry between two stops by finding a route that serves both
 * stations and using its shape, trimmed to the segment between the two stops.
 * Returns null when no shared route is found.
 */
export async function fetchRouteGeometry(
  origin: StationHit,
  destination: StationHit,
  _mode: "train" | "ferry",
): Promise<LatLng[] | null> {
  let json: any;
  try {
    json = await tlGet("routes", {
      served_by_onestop_ids: `${origin.id},${destination.id}`,
      include_geometry: "true",
      limit: 5,
    });
  } catch {
    return null;
  }
  const routes: any[] = json?.routes ?? [];
  if (!routes.length) return null;

  // Pick the route with the geometry segment that best covers both stops.
  let best: { coords: LatLng[]; score: number } | null = null;

  for (const route of routes) {
    const geom = route.geometry;
    if (!geom) continue;
    const segments: LatLng[][] = [];
    if (geom.type === "MultiLineString") {
      for (const line of geom.coordinates ?? []) {
        segments.push(line.map((c: number[]) => [c[1], c[0]] as LatLng));
      }
    } else if (geom.type === "LineString") {
      segments.push(geom.coordinates.map((c: number[]) => [c[1], c[0]] as LatLng));
    }
    for (const seg of segments) {
      if (seg.length < 2) continue;
      const trimmed = trimBetween(seg, [origin.lat, origin.lng], [destination.lat, destination.lng]);
      if (trimmed.length < 2) continue;
      // score: smaller combined squared distance from segment endpoints to stops
      const dStart = distSq(trimmed[0], [origin.lat, origin.lng]);
      const dEnd = distSq(trimmed[trimmed.length - 1], [destination.lat, destination.lng]);
      const score = dStart + dEnd;
      if (!best || score < best.score) best = { coords: trimmed, score };
    }
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
  path.forEach((p, i) => {
    const da = distSq(p, a);
    const db = distSq(p, b);
    if (da < aBest) { aBest = da; ai = i; }
    if (db < bBest) { bBest = db; bi = i; }
  });
  const [start, end] = ai <= bi ? [ai, bi] : [bi, ai];
  const slice = path.slice(start, end + 1);
  return ai <= bi ? slice : slice.reverse();
}
