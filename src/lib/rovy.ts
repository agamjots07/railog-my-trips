import Papa from "papaparse";
import { z } from "zod";

export const rovyDriveSchema = z.object({
  id: z.string().trim().min(8).max(200),
  start_date_utc: z.string().trim().min(1).max(100),
  distance_km: z.coerce.number().finite().nonnegative(),
  duration_s: z.coerce.number().finite().nonnegative(),
  avg_speed_kmh: z.preprocess(v => v == null || (typeof v === "string" && !v.trim()) ? null : Number(v), z.number().finite().nonnegative().nullable()),
  top_speed_kmh: z.preprocess(v => v == null || (typeof v === "string" && !v.trim()) ? null : Number(v), z.number().finite().nonnegative().nullable()),
  start_location: z.string().trim().max(1000).default(""),
  vehicle: z.string().trim().max(200).default(""),
});
export type RovyDrive = z.infer<typeof rovyDriveSchema>;
export type Point = [number, number];

export function utcTimestamp(value: string): string {
  const normalized = value.trim().replace(" ", "T");
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid UTC date in drives.csv.");
  return date.toISOString();
}
export function validateDrive(value: unknown): RovyDrive {
  const drive = rovyDriveSchema.parse(value);
  const start = Date.parse(utcTimestamp(drive.start_date_utc));
  if (!Number.isFinite(new Date(start + drive.duration_s * 1000).getTime())) throw new Error("Invalid drive duration.");
  return drive;
}
export function parseDrivesCsv(text: string): RovyDrive[] {
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: "greedy", transformHeader: h => h.replace(/^\uFEFF/, "").trim().toLowerCase() });
  const error = parsed.errors.find(error => error.type !== "FieldMismatch");
  if (error) throw new Error(`Could not read drives.csv: ${error.message}`);
  const required = ["id", "start_date_utc", "distance_km", "duration_s"];
  if (required.some(h => !parsed.meta.fields?.includes(h))) throw new Error(`drives.csv needs these columns: ${required.join(", ")}.`);
  const unique = new Map<string, RovyDrive>();
  parsed.data.forEach((row, index) => {
    try { const drive = validateDrive(row); unique.set(drive.id, drive); }
    catch { throw new Error(`Invalid drive on CSV row ${index + 2}. Check dates and numeric values.`); }
  });
  return [...unique.values()].sort((a, b) => utcTimestamp(b.start_date_utc).localeCompare(utcTimestamp(a.start_date_utc)));
}
export function vboKey(filename: string): string | null {
  const basename = filename.split(/[\\/]/).pop() ?? "";
  if (!/\.vbo$/i.test(basename)) return null;
  return basename.slice(0, -4).slice(-8).toLowerCase();
}
export const vehicleKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
export function localMonth(drive: RovyDrive): string {
  const date = new Date(utcTimestamp(drive.start_date_utc));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
export function topSpeed(value: number | null): number | null { return value != null && value <= 200 ? value : null; }

// VBO clock values are HHMMSS.ss; midnight is unwrapped before thinning.
export function parseVbo(text: string): Point[] {
  const route: Point[] = [];
  let data = false, lastClock: number | null = null, day = 0, keptTime: number | null = null;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (/^\[data\]$/i.test(trimmed)) { data = true; continue; }
    if (!data || !trimmed) continue;
    if (trimmed.startsWith("[")) break;
    const columns = trimmed.split(/\s+/);
    if (columns.length < 7) continue;
    const [sats, time, rawLat, rawLng, velocity, heading, height] = columns.map(Number);
    if ([sats, time, rawLat, rawLng, velocity, heading, height].some(v => v == null || !Number.isFinite(v))) continue;
    if (time == null || rawLat == null || rawLng == null || sats == null || sats <= 0) continue;
    const hours = Math.floor(time / 10000), minutes = Math.floor(time / 100) % 100, seconds = time % 100;
    if (hours > 23 || minutes > 59 || seconds >= 60 || time < 0) continue;
    const clock = hours * 3600 + minutes * 60 + seconds;
    if (lastClock != null && clock < lastClock - 43200) day += 86400;
    if (lastClock != null && clock < lastClock && lastClock - clock <= 43200) continue;
    lastClock = clock;
    const lat = rawLat / 60, lng = -rawLng / 60;
    if (lat === 0 || lng === 0 || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const previous = route.at(-1);
    if (previous && Math.abs(previous[0] - lat) < 1e-7 && Math.abs(previous[1] - lng) < 1e-7) continue;
    const elapsed = day + clock;
    if (keptTime != null && elapsed - keptTime < 5) continue;
    route.push([lat, lng]); keptTime = elapsed;
  }
  return route;
}

export function rovyTrip(drive: RovyDrive, route: Point[], vehicleId: string | null) {
  const first = route[0], last = route.at(-1);
  const start = utcTimestamp(drive.start_date_utc);
  return {
    mode: "driver" as const, rovy_drive_id: drive.id,
    start_time: start, end_time: new Date(Date.parse(start) + drive.duration_s * 1000).toISOString(),
    duration_s: drive.duration_s, distance_km: drive.distance_km,
    avg_speed_kmh: drive.avg_speed_kmh, max_speed_kmh: topSpeed(drive.top_speed_kmh),
    origin: drive.start_location || "Unknown start", destination: "Unknown destination",
    origin_lat: first?.[0] ?? null, origin_lng: first?.[1] ?? null,
    destination_lat: last?.[0] ?? null, destination_lng: last?.[1] ?? null,
    route_geometry: route.length >= 2 ? route : null,
    vehicle_id: vehicleId, is_live: false, rovy_destination_pending: route.length >= 2,
  };
}