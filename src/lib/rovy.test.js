import { describe, test, expect } from "bun:test";
import JSZip from "jszip";
import { parseDrivesCsv, parseVbo, vboKey, rovyTrip, topSpeed, utcTimestamp, vehicleKey } from "./rovy";
import { tripSeconds } from "./tripDuration";
import { roadBreakdown } from "./roadStats";

const drive = { id: "abcdefgh-drive", start_time_utc: "2026-10-30 19:00:00", end_time_utc: "2026-10-30 19:30:00", distance_km: 15, duration_s: 1200, avg_speed_kmh: 45, top_speed_kmh: 201, start_location: "Brampton", vehicle: "Kia Soul" };
const header = Object.keys(drive).join(",");
describe("Rovy import rules", () => {
  test("CSV preserves all drive fields and quoted origin names", () => {
    const row = Object.values({ ...drive, start_location: '"Brampton, Ontario"' }).join(",");
    expect(parseDrivesCsv(`${header}\n${row}`)).toEqual([{ ...drive, start_location: "Brampton, Ontario" }]);
  });
  test("CSV duplicate source IDs appear once", () => {
    const row = Object.values(drive).join(",");
    expect(parseDrivesCsv(`${header}\n${row}\n${row}`)).toHaveLength(1);
  });
  test("invalid UTC dates cannot become trips", () => { expect(() => utcTimestamp("bad-date")).toThrow(); });
  test("UTC timestamps retain their instant for local display", () => {
    expect(utcTimestamp(drive.start_time_utc)).toBe("2026-10-30T19:00:00.000Z");
    expect(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(utcTimestamp(drive.start_time_utc)))).toBe("15:00");
  });
  test("VBO matches filename stem suffix to eight-character drive prefix", () => {
    expect(vboKey("folder/2026-10-30_abcdefgh.vbo")).toBe(drive.id.slice(0, 8));
    expect(vboKey("folder/2026-10-30_abcdefgh.txt")).toBeNull();
  });
  test("VBO coordinates convert minutes and west-positive longitude", () => {
    expect(parseVbo("[data]\n8 150000 2622 4782 45 0 100")).toEqual([[43.7, -79.7]]);
  });
  test("VBO skips zero, out-of-range and nonnumeric coordinates", () => {
    expect(parseVbo("[data]\n8 150000 0 4782 0 0 0\n8 150005 99999 4782 5 0 0\n8 150010 2622 NaN 5 0 0\n0 150015 2622 4782 5 0 0")).toEqual([]);
  });
  test("VBO ignores stationary repeats and keeps roughly five-second samples", () => {
    const points = parseVbo("[data]\n8 150000 2622 4782 0 0 0\n8 150001 2622.6 4782.6 5 0 0\n8 150005 2622 4782 0 0 0\n8 150006 2622.6 4782.6 5 0 0\n8 150007 2623.2 4783.2 5 0 0\n8 150011 2623.2 4783.2 5 0 0");
    expect(points).toHaveLength(3);
    points.forEach((point, index) => { expect(point[0]).toBeCloseTo(43.7 + index * .01, 6); expect(point[1]).toBeCloseTo(-79.7 - index * .01, 6); });
  });
  test("VBO five-second thinning crosses midnight", () => {
    expect(parseVbo("[data]\n8 235958 2622 4782 5 0 0\n8 000001 2622.6 4782.6 5 0 0\n8 000003 2623.2 4783.2 5 0 0")).toHaveLength(2);
  });
  test("top speeds above 200 are blank while exactly 200 remains", () => {
    expect(topSpeed(200)).toBe(200); expect(topSpeed(200.1)).toBeNull(); expect(topSpeed(null)).toBeNull();
  });
  test("selected drives become completed Driver trips with exact CSV metrics", () => {
    const payload = rovyTrip(drive, [[43.7, -79.7], [43.71, -79.71]], "vehicle-id");
    expect(payload).toMatchObject({ mode: "driver", is_live: false, rovy_drive_id: "abcdefgh-drive", distance_km: 15, duration_s: 1200, avg_speed_kmh: 45, max_speed_kmh: null, origin: "Brampton", vehicle_id: "vehicle-id", destination_lat: 43.71, destination_lng: -79.71, rovy_destination_pending: true });
    expect(payload.route_geometry).toEqual([[43.7, -79.7], [43.71, -79.71]]);
  });
  test("drives without VBO import metrics but no fabricated route", () => {
    expect(rovyTrip(drive, [], null)).toMatchObject({ route_geometry: null, rovy_destination_pending: false, destination_lat: null });
  });
  test("vehicle matching is case- and whitespace-insensitive", () => { expect(vehicleKey("  Kia   Soul ")).toBe(vehicleKey("kia soul")); });
  test("recorded duration overrides wall-clock interval in role statistics", () => {
    const trip = rovyTrip(drive, [], null);
    expect(tripSeconds(trip)).toBe(1200);
    expect(roadBreakdown([trip]).driver).toEqual({ count: 1, km: 15, minutes: 20 });
  });
  test("unselected VBO contents stay compressed", async () => {
    const zip = new JSZip(); zip.file("drive_abcdefgh.vbo", "[data]\n8 150000 2622 4782 5 0 0"); zip.file("drive_ijklmnop.vbo", "DO NOT READ");
    const loaded = await JSZip.loadAsync(await zip.generateAsync({ type: "uint8array" }));
    const read = [];
    for (const entry of Object.values(loaded.files)) { const original = entry.async.bind(entry); entry.async = (...args) => { read.push(entry.name); return original(...args); }; }
    const selected = loaded.file("drive_abcdefgh.vbo");
    if (!selected) throw new Error("Missing fixture");
    parseVbo(await selected.async("string"));
    expect(read).toEqual(["drive_abcdefgh.vbo"]);
  });
});