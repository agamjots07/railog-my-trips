import type { Tables } from "@/integrations/supabase/types";

type Trip = Tables<"trips">;

export type Record = {
  label: string;
  value: string;
  sub?: string;
};

function durationMin(t: Trip): number | null {
  if (!t.end_time) return null;
  return (new Date(t.end_time).getTime() - new Date(t.start_time).getTime()) / 60000;
}

function fmtH(m: number) {
  const h = Math.floor(m / 60);
  const mm = Math.round(m % 60);
  return h ? `${h}h ${mm}m` : `${mm}m`;
}

function tripLabel(t: Trip) {
  return t.route_name || `${t.origin} → ${t.destination}`;
}

export function personalRecords(trips: Trip[]): Record[] {
  if (!trips.length) return [];

  const withDist = trips.filter((t) => (t.distance_km ?? 0) > 0);
  const withDur = trips.filter((t) => durationMin(t) && durationMin(t)! > 0);

  const longest = withDist.length
    ? withDist.reduce((a, b) => ((a.distance_km ?? 0) > (b.distance_km ?? 0) ? a : b))
    : null;
  const shortest = withDist.length
    ? withDist.reduce((a, b) => ((a.distance_km ?? 0) < (b.distance_km ?? 0) ? a : b))
    : null;

  const longestDur = withDur.length
    ? withDur.reduce((a, b) => (durationMin(a)! > durationMin(b)! ? a : b))
    : null;

  // Fastest = highest average speed (km/h)
  const withSpeed = withDist
    .map((t) => {
      const m = durationMin(t);
      if (!m || m <= 0) return null;
      return { t, kmh: (t.distance_km ?? 0) / (m / 60) };
    })
    .filter((x): x is { t: Trip; kmh: number } => !!x);
  const fastest = withSpeed.length
    ? withSpeed.reduce((a, b) => (a.kmh > b.kmh ? a : b))
    : null;

  // Biggest distance in one day
  const byDay = new Map<string, number>();
  for (const t of trips) {
    const d = new Date(t.start_time);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    byDay.set(key, (byDay.get(key) ?? 0) + (t.distance_km ?? 0));
  }
  const bigDay = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];

  // Most trips in a day
  const tripsPerDay = new Map<string, number>();
  for (const t of trips) {
    const d = new Date(t.start_time);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    tripsPerDay.set(key, (tripsPerDay.get(key) ?? 0) + 1);
  }
  const busiestDay = [...tripsPerDay.entries()].sort((a, b) => b[1] - a[1])[0];

  const records: Record[] = [];
  if (longest) records.push({ label: "Longest trip", value: `${longest.distance_km!.toFixed(0)} km`, sub: tripLabel(longest) });
  if (shortest && shortest !== longest)
    records.push({ label: "Shortest trip", value: `${shortest.distance_km!.toFixed(1)} km`, sub: tripLabel(shortest) });
  if (longestDur)
    records.push({ label: "Longest journey", value: fmtH(durationMin(longestDur)!), sub: tripLabel(longestDur) });
  if (fastest)
    records.push({ label: "Fastest avg speed", value: `${fastest.kmh.toFixed(0)} km/h`, sub: tripLabel(fastest.t) });
  if (bigDay)
    records.push({ label: "Biggest day", value: `${bigDay[1].toFixed(0)} km`, sub: formatDayKey(bigDay[0]) });
  if (busiestDay && busiestDay[1] > 1)
    records.push({ label: "Most trips in a day", value: `${busiestDay[1]}`, sub: formatDayKey(busiestDay[0]) });

  return records;
}

function formatDayKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m, d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
