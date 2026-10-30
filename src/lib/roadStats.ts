import { roadRole } from "./modes";
import { tripSeconds } from "./tripDuration";

type RoadTrip = { mode: string; distance_km: number | null; start_time: string; end_time: string | null; duration_s?: number | null };

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
    group.minutes += tripSeconds(trip) / 60;
  }
  return result;
}