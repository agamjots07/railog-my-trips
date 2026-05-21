// Re-ingest TTC GTFS stops + shapes from /tmp/ttc/
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { createClient } from "@supabase/supabase-js";

const SB = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const AGENCY = "ttc";
const DIR = "/tmp/ttc";

const ROUTE_TYPE_MODE = {
  "0": "tram",     // streetcar / LRT (Line 6)
  "1": "subway",
  "2": "train",
  "3": "bus",
  "4": "ferry",
};
const MODE_RANK = { train: 5, subway: 4, tram: 3, ferry: 2, bus: 1 };

// --- minimal streaming CSV parser handling quoted fields & embedded commas/newlines ---
async function* parseCsv(file) {
  const stream = createReadStream(file, { encoding: "utf8" });
  let buf = "";
  let header = null;
  let row = [];
  let field = "";
  let inQ = false;
  for await (const chunk of stream) {
    buf = chunk;
    for (let i = 0; i < buf.length; i++) {
      const c = buf[i];
      if (inQ) {
        if (c === '"') {
          if (buf[i + 1] === '"') { field += '"'; i++; } else inQ = false;
        } else field += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ",") { row.push(field); field = ""; }
        else if (c === "\n" || c === "\r") {
          if (field !== "" || row.length) { row.push(field); field = ""; }
          if (row.length) {
            if (!header) header = row;
            else { const o = {}; for (let k = 0; k < header.length; k++) o[header[k]] = row[k] ?? ""; yield o; }
            row = [];
          }
        } else field += c;
      }
    }
  }
  if (field !== "" || row.length) { row.push(field); if (!header) header = row; else { const o = {}; for (let k = 0; k < header.length; k++) o[header[k]] = row[k] ?? ""; yield o; } }
}

async function main() {
  console.log("Loading routes...");
  const routeMode = new Map();
  for await (const r of parseCsv(`${DIR}/routes.txt`)) {
    routeMode.set(r.route_id, ROUTE_TYPE_MODE[r.route_type?.trim()] ?? "bus");
  }
  console.log(`  ${routeMode.size} routes`);

  console.log("Loading trips...");
  const tripRoute = new Map();
  const shapeMode = new Map();
  for await (const t of parseCsv(`${DIR}/trips.txt`)) {
    const m = routeMode.get(t.route_id) ?? "bus";
    tripRoute.set(t.trip_id, m);
    if (t.shape_id) {
      const cur = shapeMode.get(t.shape_id);
      if (!cur || MODE_RANK[m] > MODE_RANK[cur]) shapeMode.set(t.shape_id, m);
    }
  }
  console.log(`  ${tripRoute.size} trips, ${shapeMode.size} shapes`);

  console.log("Scanning stop_times for stop modes...");
  const stopMode = new Map();
  let n = 0;
  for await (const st of parseCsv(`${DIR}/stop_times.txt`)) {
    const m = tripRoute.get(st.trip_id);
    if (!m) continue;
    const cur = stopMode.get(st.stop_id);
    if (!cur || MODE_RANK[m] > MODE_RANK[cur]) stopMode.set(st.stop_id, m);
    if (++n % 500000 === 0) console.log(`  ${n}`);
  }
  console.log(`  ${stopMode.size} stops served`);

  console.log("Loading stops...");
  const stopsRows = [];
  for await (const s of parseCsv(`${DIR}/stops.txt`)) {
    const lat = parseFloat(s.stop_lat), lng = parseFloat(s.stop_lon);
    if (!isFinite(lat) || !isFinite(lng)) continue;
    const mode = stopMode.get(s.stop_id) ?? "bus";
    stopsRows.push({
      id: `ttc:${s.stop_id}`,
      agency_id: AGENCY,
      stop_id: s.stop_id,
      name: s.stop_name,
      lat, lng,
      mode,
      parent_station: s.parent_station || null,
    });
  }
  console.log(`  ${stopsRows.length} stops`);

  console.log("Loading shapes geometry...");
  const shapePts = new Map(); // shape_id -> [{seq,lat,lng}]
  for await (const sh of parseCsv(`${DIR}/shapes.txt`)) {
    const lat = parseFloat(sh.shape_pt_lat), lng = parseFloat(sh.shape_pt_lon);
    const seq = parseInt(sh.shape_pt_sequence, 10);
    if (!isFinite(lat) || !isFinite(lng)) continue;
    let arr = shapePts.get(sh.shape_id);
    if (!arr) { arr = []; shapePts.set(sh.shape_id, arr); }
    arr.push([seq, lat, lng]);
  }
  const shapesRows = [];
  for (const [sid, arr] of shapePts) {
    const mode = shapeMode.get(sid);
    if (!mode || mode === "bus") continue; // only persist rail/tram/subway/ferry shapes
    arr.sort((a, b) => a[0] - b[0]);
    const coords = arr.map(([, la, ln]) => [la, ln]);
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const [la, ln] of coords) {
      if (la < minLat) minLat = la; if (la > maxLat) maxLat = la;
      if (ln < minLng) minLng = ln; if (ln > maxLng) maxLng = ln;
    }
    shapesRows.push({
      id: `ttc:${sid}`,
      agency_id: AGENCY,
      shape_id: sid,
      mode,
      geometry: coords,
      bbox: [minLat, minLng, maxLat, maxLng],
    });
  }
  console.log(`  ${shapesRows.length} non-bus shapes`);

  console.log("Deleting existing TTC rows...");
  await SB.from("gtfs_stops").delete().eq("agency_id", AGENCY);
  await SB.from("gtfs_shapes").delete().eq("agency_id", AGENCY);

  console.log("Inserting stops...");
  for (let i = 0; i < stopsRows.length; i += 1000) {
    const batch = stopsRows.slice(i, i + 1000);
    const { error } = await SB.from("gtfs_stops").insert(batch);
    if (error) { console.error("stops err", error); process.exit(1); }
    if (i % 5000 === 0) console.log(`  ${i}/${stopsRows.length}`);
  }
  console.log("Inserting shapes...");
  for (let i = 0; i < shapesRows.length; i += 100) {
    const batch = shapesRows.slice(i, i + 100);
    const { error } = await SB.from("gtfs_shapes").insert(batch);
    if (error) { console.error("shapes err", error); process.exit(1); }
  }

  await SB.from("gtfs_feeds").upsert({
    agency_id: AGENCY,
    name: "TTC",
    source_url: "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/ttc-routes-and-schedules",
    stop_count: stopsRows.length,
    shape_count: shapesRows.length,
    last_synced_at: new Date().toISOString(),
  }, { onConflict: "agency_id" });

  console.log("Done.");
}
main().catch((e) => { console.error(e); process.exit(1); });
