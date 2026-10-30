import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import JSZip from "jszip";
import { ArrowLeft, Upload, Check, Car, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { parseDrivesCsv, parseVbo, vboKey, vehicleKey, localMonth, utcTimestamp, type RovyDrive } from "@/lib/rovy";
import { rovyImportData, importRovyDrive, createRovyVehicle } from "@/lib/rovy.functions";
import { toast } from "sonner";

const importOptions = queryOptions({ queryKey: ["rovy-import"], queryFn: () => rovyImportData(), staleTime: 0 });
export const Route = createFileRoute("/_authenticated/import-rovy")({
  head: () => ({ meta: [{ title: "Import from Rovy — Pencer" }, { name: "description", content: "Choose Rovy drives to add to your Pencer Driver history with GPS routes and Garage vehicles." }, { property: "og:title", content: "Import from Rovy — Pencer" }, { property: "og:description", content: "Select and import Rovy drives into your personal journey history." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(importOptions),
  component: RovyImportPage,
});

function RovyImportPage() {
  const { data } = useSuspenseQuery(importOptions);
  const client = useQueryClient();
  const importDrive = useServerFn(importRovyDrive), createVehicle = useServerFn(createRovyVehicle);
  const [csv, setCsv] = useState<File | null>(null), [zip, setZip] = useState<File | null>(null);
  const [drives, setDrives] = useState<RovyDrive[]>([]);
  const [archive, setArchive] = useState<JSZip | null>(null);
  const [files, setFiles] = useState<Map<string, string>>(new Map());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [month, setMonth] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [newNames, setNewNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number; added: number; duplicates: number; failed: number } | null>(null);
  const known = useMemo(() => new Set([...data.imported, ...imported]), [data.imported, imported]);
  const months = useMemo(() => [...new Set(drives.map(localMonth))].sort().reverse(), [drives]);
  const visible = useMemo(() => drives.filter(d => !month || localMonth(d) === month), [drives, month]);
  const names = useMemo(() => [...new Set(drives.filter(d => selected.has(d.id) && d.vehicle).map(d => d.vehicle))], [drives, selected]);
  const getVehicle = (name: string) => mapping[name] ?? data.vehicles.find(v => vehicleKey(v.name) === vehicleKey(name))?.id ?? "";
  const unresolved = names.some(name => !getVehicle(name) || (getVehicle(name) === "create" && !(newNames[name] ?? name).trim()));

  const preview = async () => {
    if (!csv || !zip) return;
    setLoading(true); setError(""); setProgress(null);
    try {
      const parsed = parseDrivesCsv(await csv.text());
      // Central-directory inspection only; entry contents stay compressed until selected.
      const loaded = await JSZip.loadAsync(zip);
      const indexed = new Map<string, string>();
      for (const entry of Object.values(loaded.files)) {
        if (entry.dir || entry.name.startsWith("__MACOSX/")) continue;
        const key = vboKey(entry.name);
        if (!key) continue;
        if (indexed.has(key)) throw new Error(`The ZIP has multiple VBO files ending in ${key}. Remove the duplicate files and retry.`);
        indexed.set(key, entry.name);
      }
      setDrives(parsed); setArchive(loaded); setFiles(indexed); setSelected(new Set()); setMonth(""); setMapping({});
      if (!parsed.length) setError("No drives were found in drives.csv.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not read the exports."); }
    finally { setLoading(false); }
  };
  const toggle = (id: string) => setSelected(previous => {
    const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });
  const startImport = async () => {
    if (!archive || unresolved || busy) return;
    const chosen = drives.filter(d => selected.has(d.id) && !known.has(d.id));
    if (!chosen.length) return;
    setBusy(true); setError("");
    const state = { done: 0, total: chosen.length, added: 0, duplicates: 0, failed: 0 };
    setProgress({ ...state });
    const resolved = new Map<string, string | null>();
    try {
      for (const name of names) {
        const choice = getVehicle(name);
        if (choice === "create") {
          const vehicle = await createVehicle({ data: { name: (newNames[name] ?? name).trim() } });
          resolved.set(name, vehicle.id);
          setMapping(previous => ({ ...previous, [name]: vehicle.id }));
        } else resolved.set(name, choice === "none" ? null : choice);
      }
      for (const drive of chosen) {
        try {
          const path = files.get(drive.id.slice(0, 8).toLowerCase());
          const entry = path ? archive.file(path) : null;
          const route = entry ? parseVbo(await entry.async("string")) : [];
          const result = await importDrive({ data: { drive, route, vehicleId: resolved.get(drive.vehicle) ?? null } });
          if (result.status === "imported") state.added++; else state.duplicates++;
          setImported(previous => new Set([...previous, drive.id]));
          setSelected(previous => { const next = new Set(previous); next.delete(drive.id); return next; });
        } catch { state.failed++; }
        state.done++; setProgress({ ...state });
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (state.failed) setError(`${state.failed} drives could not be imported. They remain selected so you can retry.`);
      if (state.added) toast.success(`${state.added} Driver trips imported`);
    } catch (e) { setError(e instanceof Error ? e.message : "Import could not start."); }
    finally { setBusy(false); await client.invalidateQueries(); }
  };
  return (
    <div className="px-5 pt-6 pb-8">
      <Button asChild variant="ghost" size="sm" className="mb-5"><Link to="/settings"><ArrowLeft /> Settings</Link></Button>
      <p className="text-xs font-semibold uppercase text-muted-foreground">Trip history</p>
      <h1 className="mt-2 text-3xl font-bold">Import from Rovy</h1>
      <div className="mt-6 space-y-4 border-b border-border pb-6">
        <label className="block text-sm font-medium">Rovy VBO export (.zip)<Input className="mt-2 h-auto py-3" type="file" accept=".zip" disabled={busy || loading} onChange={e => setZip(e.target.files?.[0] ?? null)} /></label>
        <label className="block text-sm font-medium">drives.csv<Input className="mt-2 h-auto py-3" type="file" accept=".csv" disabled={busy || loading} onChange={e => setCsv(e.target.files?.[0] ?? null)} /></label>
        <Button onClick={preview} disabled={!csv || !zip || loading || busy} className="w-full">{loading ? <Loader2 className="animate-spin" /> : <Upload />} {loading ? "Reading drive list…" : "Review drives"}</Button>
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      {drives.length > 0 && <>
        <div className="mt-6 flex items-center justify-between gap-3">
          <h2 className="font-semibold">{drives.length} drives</h2>
          <select aria-label="Filter by month" value={month} onChange={e => setMonth(e.target.value)} disabled={busy} className="min-w-0 rounded-md border border-border bg-background p-2 text-sm">
            <option value="">All months</option>{months.map(m => <option key={m} value={m}>{new Date(`${m}-15T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</option>)}
          </select>
        </div>
        <div className="my-3 flex items-center gap-2">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setSelected(previous => new Set([...previous, ...visible.filter(d => !known.has(d.id)).map(d => d.id)]))}>Select all</Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setSelected(new Set())}>Clear</Button>
          <span className="ml-auto text-xs text-muted-foreground">{selected.size} selected</span>
        </div>
        <div className="max-h-[480px] overflow-y-auto divide-y divide-border border-y border-border">
          {visible.map(d => {
            const done = known.has(d.id), available = files.has(d.id.slice(0, 8).toLowerCase());
            return <label key={d.id} className={`flex items-start gap-3 py-4 ${done ? "opacity-40" : "cursor-pointer"}`}>
              <Checkbox aria-label={`Select drive ${d.id}`} checked={!done && selected.has(d.id)} disabled={done || busy} onCheckedChange={() => toggle(d.id)} className="mt-1 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2"><time className="text-sm font-semibold">{new Date(utcTimestamp(d.start_time_utc)).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</time><span className="shrink-0 text-xs tabular-nums">{d.distance_km.toFixed(1)} km</span></div>
                <p className="mt-1 break-words text-sm">{d.start_location || "Unknown start"}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Car className="h-3 w-3" />{d.vehicle || "No vehicle"}</span><span className="flex items-center gap-1">{done ? <Check className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}{done ? "Already imported" : available ? "VBO available" : "No route file"}</span></div>
              </div>
            </label>;
          })}
        </div>
        {names.length > 0 && <section className="mt-6 space-y-4">
          <h2 className="font-semibold">Garage vehicles</h2>
          {names.map(name => <div key={name}>
            <label className="mb-2 block break-words text-sm" htmlFor={`vehicle-${name}`}>{name}</label>
            <select id={`vehicle-${name}`} aria-label={`Garage vehicle for ${name}`} value={getVehicle(name)} disabled={busy} onChange={e => setMapping(previous => ({ ...previous, [name]: e.target.value }))} className="w-full rounded-md border border-border bg-background p-3 text-sm">
              <option value="">Choose vehicle…</option>{data.vehicles.map(v => <option value={v.id} key={v.id}>{v.name}</option>)}<option value="create">Create Garage vehicle</option><option value="none">No vehicle</option>
            </select>
            {getVehicle(name) === "create" && <Input aria-label={`New vehicle name for ${name}`} value={newNames[name] ?? name} maxLength={200} disabled={busy} className="mt-2" onChange={e => setNewNames(previous => ({ ...previous, [name]: e.target.value }))} />}
          </div>)}
        </section>}
        {progress && <div className="mt-6" role="status" aria-live="polite">
          <progress aria-label="Import progress" value={progress.done} max={progress.total} className="h-2 w-full accent-primary" />
          <p className="mt-2 text-sm">{busy ? `Importing ${progress.done} of ${progress.total}…` : `${progress.added} imported · ${progress.duplicates} already imported · ${progress.failed} failed`}</p>
        </div>}
        <Button className="mt-6 w-full" disabled={busy || selected.size === 0 || unresolved} onClick={startImport}>{busy ? <Loader2 className="animate-spin" /> : <Upload />} {busy ? "Importing…" : `Import selected (${selected.size})`}</Button>
      </>}
    </div>
  );
}