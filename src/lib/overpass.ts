// Overpass API helpers — OpenStreetMap, no API key required.
// Used for station autocomplete and route geometry between two stations.

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export type LatLng = [number, number];

export type StationHit = {
  osmType: "node" | "way" | "relation";
  osmId: number;
  name: string;
  label: string; // name + locality hint
  lat: number;
  lng: number;
  kind: string; // railway=station, amenity=ferry_terminal, etc.
};

async function overpass(query: string): Promise<any> {
  let lastErr: unknown = null;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(query),
      });
      if (!res.ok) {
        lastErr = new Error(`Overpass ${res.status}`);
        continue;
      }
      return await res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("Overpass request failed");
}

/** Escape a name fragment for safe use inside an Overpass regex. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Search stations / terminals matching `query` for the given mode. */
export async function searchStations(
  query: string,
  mode: "train" | "ferry",
  limit = 8,
): Promise<StationHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const re = escapeRegex(q);

  const filters =
    mode === "ferry"
      ? `
        node["amenity"="ferry_terminal"]["name"~"${re}",i];
        way["amenity"="ferry_terminal"]["name"~"${re}",i];
      `
      : `
        node["railway"="station"]["name"~"${re}",i];
        node["railway"="halt"]["name"~"${re}",i];
        node["public_transport"="station"]["train"="yes"]["name"~"${re}",i];
      `;

  const ql = `[out:json][timeout:15];(${filters});out center ${limit};`;
  const json = await overpass(ql);
  const elements: any[] = json.elements ?? [];
  return elements
    .map((el) => {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (lat == null || lng == null) return null;
      const name = el.tags?.name ?? "Unnamed";
      const locality =
        el.tags?.["addr:city"] ||
        el.tags?.["is_in:city"] ||
        el.tags?.["is_in"] ||
        el.tags?.operator ||
        "";
      const kind =
        el.tags?.railway === "halt"
          ? "Station (halt)"
          : el.tags?.railway === "station"
            ? "Train station"
            : el.tags?.amenity === "ferry_terminal"
              ? "Ferry terminal"
              : "Station";
      return {
        osmType: el.type as StationHit["osmType"],
        osmId: el.id as number,
        name,
        label: locality ? `${name} · ${locality}` : name,
        lat,
        lng,
        kind,
      };
    })
    .filter(Boolean) as StationHit[];
}

/**
 * Fetch the actual rail/ferry route polyline between two stations from OSM
 * route relations that contain BOTH stations as members.
 * Returns null when no shared route relation is found.
 */
export async function fetchRouteGeometry(
  origin: StationHit,
  destination: StationHit,
  mode: "train" | "ferry",
): Promise<LatLng[] | null> {
  const routeFilter =
    mode === "ferry"
      ? `["route"="ferry"]`
      : `["route"~"^(train|subway|light_rail|tram|monorail|railway)$"]`;

  // Both stations are typically nodes; chain (bn:...) filters for intersection.
  if (origin.osmType !== "node" || destination.osmType !== "node") return null;

  const ql = `[out:json][timeout:30];rel(bn:${origin.osmId})(bn:${destination.osmId})${routeFilter};out geom;`;
  let json: any;
  try {
    json = await overpass(ql);
  } catch {
    return null;
  }
  const rel = (json.elements ?? [])[0];
  if (!rel) return null;

  // Concatenate way-member geometries in member order.
  const coords: LatLng[] = [];
  for (const m of rel.members ?? []) {
    if (m.type !== "way" || !Array.isArray(m.geometry)) continue;
    for (const g of m.geometry) {
      const last = coords[coords.length - 1];
      if (!last || last[0] !== g.lat || last[1] !== g.lon) {
        coords.push([g.lat, g.lon]);
      }
    }
  }
  if (coords.length < 2) return null;

  // Trim to the segment between the two stations (closest points).
  const trimmed = trimBetween(coords, [origin.lat, origin.lng], [destination.lat, destination.lng]);
  return trimmed.length >= 2 ? trimmed : coords;
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
