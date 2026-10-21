import { roadRole } from "./modes";

type RoadTrip = { mode: string; distance_km: number | null; start_time: string; end_time: string | null };

export function roadBreakdown(trips: RoadTrip[]) {
  const result = {
    driver: { count: 0, km: 0, minutes: 0 },
    passenger: { count: 0, km: 0, minutes: 0 },
  };
  for (const trip of trips) {
    const role = roadRole(trip.mode);
    if (!role) continue;
    const group = result[role];
    group.count++;
    group.km += trip.distance_km ?? 0;
    if (trip.end_time) {
      const minutes = (Date.parse(trip.end_time) - Date.parse(trip.start_time)) / 60000;
      if (Number.isFinite(minutes)) group.minutes += Math.max(0, minutes);
    }
  }
  return result;
}