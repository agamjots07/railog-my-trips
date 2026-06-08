import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";
import { ChevronLeft, Plus, Trash2, Car, Search, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import { CAR_MAKES, CAR_YEARS } from "@/lib/carDatabase";

export const Route = createFileRoute("/_authenticated/garage")({
  head: () => ({ meta: [{ title: "Garage — Pencer" }] }),
  component: GaragePage,
});

type Vehicle = Tables<"vehicles">;
type Trip = Tables<"trips">;

const COLOR_SWATCHES = [
  "#fb923c", "#ef4444", "#f59e0b", "#10b981",
  "#06b6d4", "#3b82f6", "#a855f7", "#ec4899",
  "#475569", "#e5e7eb",
];

function GaragePage() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const [{ data: v }, { data: t }] = await Promise.all([
      supabase.from("vehicles").select("*").order("created_at", { ascending: false }),
      supabase.from("trips").select("*").not("vehicle_id", "is", null),
    ]);
    setVehicles(v ?? []);
    setTrips(t ?? []);
  };

  useEffect(() => {
    if (!user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const statsByVehicle = useMemo(() => {
    const m = new Map<string, { trips: number; km: number }>();
    for (const t of trips) {
      if (!t.vehicle_id) continue;
      const s = m.get(t.vehicle_id) ?? { trips: 0, km: 0 };
      s.trips += 1;
      s.km += t.distance_km ?? 0;
      m.set(t.vehicle_id, s);
    }
    return m;
  }, [trips]);

  const remove = async (id: string) => {
    if (!confirm("Delete this vehicle?")) return;
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    load();
  };

  return (
    <div className="relative px-5 pt-6 pb-10">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 -z-10"
        style={{ background: "var(--gradient-hero)" }}
      />

      <Link
        to="/settings"
        className="mb-6 inline-flex items-center gap-1 rounded-full border border-white/[0.06] bg-card/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Settings
      </Link>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Garage
          </p>
          <h1 className="mt-2 text-[34px] font-bold leading-[1.05] tracking-tight">
            Your vehicles
          </h1>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex h-11 w-11 items-center justify-center rounded-full text-primary-foreground"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
          aria-label="Add vehicle"
        >
          <Plus className="h-5 w-5" strokeWidth={2.75} />
        </button>
      </div>

      {showForm && (
        <VehicleForm
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      <div className="mt-6 space-y-3">
        {vehicles?.length === 0 && !showForm && (
          <div className="rounded-3xl border border-white/[0.06] bg-card p-8 text-center">
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: "linear-gradient(135deg,#fb923c,#f97316)" }}
            >
              <Car className="h-6 w-6 text-white" strokeWidth={2.5} />
            </div>
            <p className="text-sm font-bold">No vehicles yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add one to attach it to Taxi / Uber rides.
            </p>
          </div>
        )}
        {vehicles?.map((v) => {
          const s = statsByVehicle.get(v.id) ?? { trips: 0, km: 0 };
          return (
            <div
              key={v.id}
              className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-card p-5"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
                  style={{ background: v.color || "#fb923c" }}
                >
                  <Car className="h-6 w-6" strokeWidth={2.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px] font-bold leading-tight">{v.name}</p>
                  <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                    {[v.year, v.make, v.model].filter(Boolean).join(" ") || "—"}
                  </p>
                </div>
                <button
                  onClick={() => remove(v.id)}
                  className="text-muted-foreground transition hover:text-destructive"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 flex items-center gap-5 border-t border-white/[0.05] pt-3.5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    Trips
                  </span>
                  <span className="font-mono text-sm font-bold tabular-nums">{s.trips}</span>
                </div>
                <div className="h-8 w-px bg-white/[0.05]" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    Distance
                  </span>
                  <span className="font-mono text-sm font-bold tabular-nums">
                    {s.km > 0 ? `${s.km.toFixed(s.km < 10 ? 2 : 0)} km` : "—"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VehicleForm({ onSaved }: { onSaved: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState<number | "">("");
  const [color, setColor] = useState(COLOR_SWATCHES[0]);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("vehicles").insert({
      user_id: user.id,
      name: name || [year, make, model].filter(Boolean).join(" ") || "My Vehicle",
      make: make || null,
      model: model || null,
      year: year === "" ? null : year,
      color,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Vehicle added");
    onSaved();
  };

  return (
    <form
      onSubmit={submit}
      className="mt-6 space-y-4 rounded-3xl border border-white/[0.06] bg-card p-5"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <Field label="Make">
        <Combobox
          value={make}
          onChange={(v) => {
            setMake(v);
            setModel("");
          }}
          options={CAR_MAKES.map((m) => m.name)}
          placeholder="Search 40+ brands…"
        />
      </Field>
      <div className="my-4 h-px bg-white/[0.05]" />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Model">
          <Combobox
            value={model}
            onChange={setModel}
            options={CAR_MAKES.find((m) => m.name === make)?.models ?? []}
            placeholder={make ? "Search models…" : "Pick make first"}
            disabled={!make}
          />
        </Field>
        <Field label="Year">
          <select
            value={year}
            onChange={(e) => setYear(e.target.value ? Number(e.target.value) : "")}
            className={inputCls}
          >
            <option value="">—</option>
            {CAR_YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="my-4 h-px bg-white/[0.05]" />
      <Field label="Nickname (optional)">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={[year, make, model].filter(Boolean).join(" ") || "e.g. My Tesla"}
          className={inputCls}
        />
      </Field>
      <div className="my-4 h-px bg-white/[0.05]" />
      <Field label="Color">
        <div className="flex flex-wrap gap-2">
          {COLOR_SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-9 w-9 rounded-full transition ${color === c ? "ring-2 ring-white ring-offset-2 ring-offset-card" : ""}`}
              style={{ background: c }}
              aria-label={c}
            />
          ))}
        </div>
      </Field>
      <button
        type="submit"
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-primary-foreground transition active:scale-[0.98] disabled:opacity-60"
        style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
      >
        {busy ? "Saving…" : "Add to garage"}
      </button>
    </form>
  );
}

function Combobox({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((o) => !o);
          setQuery("");
        }}
        className="flex w-full items-center justify-between gap-2 bg-transparent py-0.5 text-left text-[15px] font-medium outline-none disabled:opacity-50"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground/60"}>
          {value || placeholder || "Select…"}
        </span>
        {value ? (
          <X
            className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
          />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-white/[0.08] bg-card shadow-2xl">
          <div className="flex items-center gap-2 border-b border-white/[0.05] px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                No matches. You can also{" "}
                <button
                  type="button"
                  className="font-semibold text-primary"
                  onClick={() => {
                    onChange(query);
                    setOpen(false);
                  }}
                >
                  use "{query}"
                </button>
              </div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => {
                    onChange(o);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center px-3 py-2 text-left text-sm transition hover:bg-white/[0.04] ${
                    o === value ? "font-semibold text-primary" : "text-foreground"
                  }`}
                >
                  {o}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full bg-transparent px-0 py-0.5 text-[15px] font-medium outline-none placeholder:text-muted-foreground/60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
