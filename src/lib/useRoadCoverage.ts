import { useCallback, useEffect, useRef, useState } from "react";
import type { Tables } from "@/integrations/supabase/types";
import {
  addTrackCells,
  cellsToKm,
  geocodeArea,
  lookupArea,
  measureAreaRoadKm,
  referenceCountryKm,
  referenceRegionKm,
  type CoverageLevel,
  type LatLng,
} from "./roadCoverage";

type Trip = Tables<"trips">;

export type RoadCoverage = {
  loading: boolean;
  levels: CoverageLevel[];
  driveCount: number;
};

const LEVELS_CACHE_KEY = "pencer.coverage.levels";

function readLevelsCache(sig: string): CoverageLevel[] | null {
  try {
    const raw = localStorage.getItem(LEVELS_CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { sig: string; levels: CoverageLevel[]; at: number };
    if (p.sig !== sig) return null;
    if (Date.now() - p.at > 7 * 24 * 3600 * 1000) return null;
    return p.levels;
  } catch {
    return null;
  }
}

function isGpsDrive(t: Trip): boolean {
  if (t.mode !== "taxi") return false;
  const geo = t.route_geometry as unknown as LatLng[] | null;
  if (!Array.isArray(geo) || geo.length < 2) return false;
  return Boolean(t.is_live) || t.max_speed_kmh != null || t.avg_speed_kmh != null || geo.length > 30;
}

/**
 * Roads coverage from live-GPS Drive trips only (manually logged trips are
 * excluded — they have no recorded track).
 */
export function useRoadCoverage(trips: Trip[] | null): RoadCoverage & {
  search: (query: string) => Promise<CoverageLevel | { error: string }>;
} {
  const [state, setState] = useState<RoadCoverage>({ loading: true, levels: [], driveCount: 0 });
  const drivesRef = useRef<Trip[]>([]);

  useEffect(() => {
    if (!trips) return;
    let cancelled = false;

    const drives = trips.filter(isGpsDrive);
    drivesRef.current = drives;

    if (drives.length === 0) {
      setState({ loading: false, levels: [], driveCount: 0 });
      return;
    }

    const sig = drives.map((d) => `${d.id}:${(d.route_geometry as any[]).length}`).sort().join("|");
    const cachedLevels = readLevelsCache(sig);
    if (cachedLevels) {
      setState({ loading: false, levels: cachedLevels, driveCount: drives.length });
      return;
    }

    (async () => {
      setState((s) => ({ ...s, loading: true, driveCount: drives.length }));

      const byCountry = new Map<string, Set<string>>();
      const byRegion = new Map<string, Set<string>>();
      const byCity = new Map<string, Set<string>>();

      const bucket = (map: Map<string, Set<string>>, name: string) => {
        let set = map.get(name);
        if (!set) { set = new Set(); map.set(name, set); }
        return set;
      };

      for (const t of drives) {
        const geo = t.route_geometry as unknown as LatLng[];
        const mid = geo[Math.floor(geo.length / 2)] ?? geo[0]!;
        const area = await lookupArea(mid);
        if (cancelled) return;
        if (!area) continue;
        if (area.country) addTrackCells(geo, bucket(byCountry, area.country));
        if (area.region) addTrackCells(geo, bucket(byRegion, area.region));
        if (area.city) addTrackCells(geo, bucket(byCity, area.city));
      }

      const top = (map: Map<string, Set<string>>) =>
        [...map.entries()].sort((a, b) => b[1].size - a[1].size)[0] ?? null;

      const build = async (
        kind: CoverageLevel["kind"],
        entry: [string, Set<string>] | null,
        reference: number | null,
      ): Promise<CoverageLevel | null> => {
        if (!entry) return null;
        const [name, cells] = entry;
        const coveredKm = cellsToKm(cells);
        let totalKm = reference;
        let source: CoverageLevel["source"] = "reference";
        if (totalKm == null) {
          totalKm = await measureAreaRoadKm(name);
          source = "measured";
        }
        return {
          kind,
          name,
          coveredKm,
          totalKm,
          pct: totalKm ? (coveredKm / totalKm) * 100 : null,
          source,
        };
      };

      const country = top(byCountry);
      const region = top(byRegion);
      const city = top(byCity);

      // Measured in parallel — each is independently cached for 30 days.
      const results = await Promise.all([
        build("country", country, country ? referenceCountryKm(country[0]) : null),
        build("region", region, region ? referenceRegionKm(region[0]) : null),
        build("city", city, null),
      ]);
      if (cancelled) return;

      const levels = results.filter(Boolean) as CoverageLevel[];
      try {
        localStorage.setItem(LEVELS_CACHE_KEY, JSON.stringify({ sig, levels, at: Date.now() }));
      } catch { /* ignore */ }

      setState({ loading: false, levels, driveCount: drives.length });
    })();

    return () => { cancelled = true; };
  }, [trips]);

  /** Coverage for any searched place — city, province/state or country. */
  const search = useCallback(async (query: string): Promise<CoverageLevel | { error: string }> => {
    const area = await geocodeArea(query);
    if (!area) return { error: `Couldn't find "${query}" on the map.` };

    const cells = new Set<string>();
    for (const t of drivesRef.current) {
      const geo = t.route_geometry as unknown as LatLng[];
      addTrackCells(geo, cells, area.bbox);
    }
    const coveredKm = cellsToKm(cells);

    let totalKm: number | null =
      area.kind === "country"
        ? referenceCountryKm(area.name)
        : area.kind === "region"
          ? referenceRegionKm(area.name)
          : null;
    let source: CoverageLevel["source"] = totalKm != null ? "reference" : "measured";
    if (totalKm == null) {
      totalKm = await measureAreaRoadKm(area.name, area);
      source = "measured";
    }
    if (totalKm == null) return { error: `Road data for "${area.name}" isn't available right now.` };

    return {
      kind: area.kind,
      name: area.name,
      coveredKm,
      totalKm,
      pct: (coveredKm / totalKm) * 100,
      source,
    };
  }, []);

  return { ...state, search };
}
