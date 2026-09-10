// Roads coverage — how much of the road network a user's live-GPS Drive trips cover.
//
// Covered distance is de-duplicated: every GPS track is snapped onto a ~25 m
// grid, so driving the same street ten times still counts once.
// Reference totals (total road km in a country / province / city) come from
// OpenStreetMap: city totals are measured live with an Overpass
// `sum(length())` query, country + province totals use a curated OSM/statistics
// table (those areas are far too large to measure on demand).

import { haversineKm } from "./geo";

export type LatLng = [number, number];

export type CoverageLevel = {
  kind: "country" | "region" | "city";
  name: string;
  coveredKm: number;
  totalKm: number | null;
  pct: number | null;
  source: "measured" | "reference";
};

/* ------------------------------------------------------------------ */
/* Covered distance (grid de-duplication)                              */
/* ------------------------------------------------------------------ */

const CELL_M = 25;
const CELL_KM = CELL_M / 1000;

function cellKey(lat: number, lng: number): string {
  const dLat = CELL_M / 111_320;
  const dLng = CELL_M / (111_320 * Math.max(0.15, Math.cos((lat * Math.PI) / 180)));
  return `${Math.round(lat / dLat)}:${Math.round(lng / dLng)}`;
}

export type Bbox = { south: number; west: number; north: number; east: number };

function inBbox(p: LatLng, b: Bbox): boolean {
  return p[0] >= b.south && p[0] <= b.north && p[1] >= b.west && p[1] <= b.east;
}

/** Add every ~25 m step along a GPS track to `cells`. */
export function addTrackCells(track: LatLng[], cells: Set<string>, bbox?: Bbox): void {
  if (!track || track.length < 2) return;
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1];
    const b = track[i];
    if (!a || !b) continue;
    if (bbox && !(inBbox(a, bbox) || inBbox(b, bbox))) continue;
    const segKm = haversineKm(a, b);
    // Ignore absurd jumps (GPS glitches / teleports).
    if (segKm > 2) continue;
    const steps = Math.max(1, Math.ceil(segKm / CELL_KM));
    for (let s = 0; s <= steps; s++) {
      const f = s / steps;
      cells.add(cellKey(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f));
    }
  }
}

export function cellsToKm(cells: Set<string>): number {
  return cells.size * CELL_KM;
}

/* ------------------------------------------------------------------ */
/* Reference road-network lengths                                      */
/* ------------------------------------------------------------------ */

// Approximate total public road length in km.
const COUNTRY_KM: Record<string, number> = {
  Canada: 1_042_300,
  "United States": 6_586_610,
  "United Kingdom": 422_100,
  France: 1_053_215,
  Germany: 830_000,
  Australia: 873_573,
  India: 6_371_847,
  Mexico: 806_935,
  Japan: 1_218_772,
  Italy: 487_700,
  Spain: 683_175,
  Netherlands: 139_295,
  Ireland: 99_830,
};

const REGION_KM: Record<string, number> = {
  // Canada
  Ontario: 250_000,
  Quebec: 185_000,
  "British Columbia": 73_000,
  Alberta: 230_000,
  Saskatchewan: 226_000,
  Manitoba: 87_000,
  "Nova Scotia": 27_000,
  "New Brunswick": 30_000,
  "Newfoundland and Labrador": 20_000,
  "Prince Edward Island": 5_500,
  Yukon: 5_000,
  "Northwest Territories": 2_200,
  Nunavut: 850,
  // Selected US states
  California: 628_000,
  "New York": 380_000,
  Texas: 1_300_000,
  Florida: 439_000,
  Michigan: 400_000,
  Illinois: 480_000,
  Washington: 270_000,
  Arizona: 210_000,
  Nevada: 90_000,
  Massachusetts: 118_000,
  Pennsylvania: 396_000,
  Ohio: 410_000,
};

export function referenceCountryKm(name: string): number | null {
  return COUNTRY_KM[name] ?? null;
}

export function referenceRegionKm(name: string): number | null {
  return REGION_KM[name] ?? null;
}

/* ------------------------------------------------------------------ */
/* Overpass measurement (cities)                                       */
/* ------------------------------------------------------------------ */

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const HIGHWAY_RE =
  "^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|road)$";

const CACHE_PREFIX = "pencer.roadlen.";
const CACHE_TTL_MS = 30 * 24 * 3600 * 1000;

function readCache(name: string): number | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + name);
    if (!raw) return null;
    const { km, at } = JSON.parse(raw) as { km: number; at: number };
    if (Date.now() - at > CACHE_TTL_MS) return null;
    return km;
  } catch {
    return null;
  }
}

function writeCache(name: string, km: number) {
  try {
    localStorage.setItem(CACHE_PREFIX + name, JSON.stringify({ km, at: Date.now() }));
  } catch { /* ignore */ }
}

/** Total road length (km) inside a named administrative area, via Overpass. */
export async function measureAreaRoadKm(name: string): Promise<number | null> {
  const cached = readCache(name);
  if (cached != null) return cached;

  const safe = name.replace(/["\\]/g, "");
  const ql = `[out:json][timeout:180];
area["name"="${safe}"]["boundary"="administrative"]->.a;
way(area.a)["highway"~"${HIGHWAY_RE}"];
make stat total_m=sum(length());
out;`;

  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(ql),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { elements?: any[] };
      const el = json.elements?.[0];
      const raw = el?.tags?.total_m ?? el?.total_m;
      const meters = raw != null ? Number(raw) : NaN;
      if (Number.isFinite(meters) && meters > 0) {
        const km = meters / 1000;
        writeCache(name, km);
        return km;
      }
    } catch { /* try next endpoint */ }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Area lookup                                                         */
/* ------------------------------------------------------------------ */

export type AreaNames = { city: string | null; region: string | null; country: string | null };

const areaCache = new Map<string, AreaNames>();

/** Reverse-geocode a point to its city / province-state / country names. */
export async function lookupArea(point: LatLng): Promise<AreaNames | null> {
  const k = `${point[0].toFixed(2)},${point[1].toFixed(2)}`;
  const hit = areaCache.get(k);
  if (hit) return hit;
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${point[0]}&lon=${point[1]}&zoom=10&addressdetails=1`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as { address?: Record<string, string> };
    const a = json.address ?? {};
    const out: AreaNames = {
      city: a.city || a.town || a.village || a.municipality || a.county || null,
      region: a.state || a.province || null,
      country: a.country || null,
    };
    areaCache.set(k, out);
    return out;
  } catch {
    return null;
  }
}
