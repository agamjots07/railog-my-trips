type TimedTrip = { start_time: string; end_time: string | null; duration_s?: number | null };
export function tripSeconds(trip: TimedTrip): number {
  if (trip.duration_s != null && Number.isFinite(trip.duration_s)) return Math.max(0, trip.duration_s);
  if (!trip.end_time) return 0;
  const seconds = (Date.parse(trip.end_time) - Date.parse(trip.start_time)) / 1000;
  return Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
}