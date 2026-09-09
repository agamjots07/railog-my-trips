import { useEffect, useState } from "react";
import type { Tables } from "@/integrations/supabase/types";
import {
  addTrackCells,
  cellsToKm,
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

/**
 * Roads coverage from live-GPS Drive trips only (manually logged trips are
 * excluded — they have no recorded track).
 */
export function useRoadCoverage(trips: Trip[] | null): RoadCoverage {
  const [state, setState] = useState<RoadCoverage>({ loading: true, levels: [], driveCount: 0 });

  useEffect(() => {
    if (!trips) return;
    let cancelled = false;

    // A GPS-recorded drive: it either is/was a live recording, carries recorded
    // speed data, or has a dense track (manual logs only store a few waypoints).
    const drives = trips.filter((t) => {
      if (t.mode !== "taxi") return false;
      const geo = t.route_geometry as unknown as LatLng[] | null;
      if (!Array.isArray(geo) || geo.length < 2) return false;
      return Boolean(t.is_live) || t.max_speed_kmh != null || t.avg_speed_kmh != null || geo.length > 30;
    });

    if (drives.length === 0) {
      setState({ loading: false, levels: [], driveCount: 0 });
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
        await new Promise((r) => setTimeout(r, 250)); // be gentle with Nominatim
        if (!area) continue;
        if (area.country) addTrackCells(geo, bucket(byCountry, area.country));
        if (area.region) addTrackCells(geo, bucket(byRegion, area.region));
        if (area.city) addTrackCells(geo, bucket(byCity, area.city));
      }

      const top = (map: Map<string, Set<string>>) =>
        [...map.entries()].sort((a, b) => b[1].size - a[1].size)[0] ?? null;

      const country = top(byCountry);
      const region = top(byRegion);
      const city = top(byCity);

      const levels: CoverageLevel[] = [];

      const push = async (
        kind: CoverageLevel["kind"],
        entry: [string, Set<string>] | null,
        reference: number | null,
      ) => {
        if (!entry) return;
        const [name, cells] = entry;
        const coveredKm = cellsToKm(cells);
        let totalKm = reference;
        let source: CoverageLevel["source"] = "reference";
        if (totalKm == null) {
          totalKm = await measureAreaRoadKm(name);
          source = "measured";
        }
        levels.push({
          kind,
          name,
          coveredKm,
          totalKm,
          pct: totalKm ? (coveredKm / totalKm) * 100 : null,
          source,
        });
      };

      await push("country", country, country ? referenceCountryKm(country[0]) : null);
      if (cancelled) return;
      await push("region", region, region ? referenceRegionKm(region[0]) : null);
      if (cancelled) return;
      await push("city", city, null); // cities are measured live from OSM
      if (cancelled) return;

      setState({ loading: false, levels, driveCount: drives.length });
    })();

    return () => { cancelled = true; };
  }, [trips]);

  return state;
}
