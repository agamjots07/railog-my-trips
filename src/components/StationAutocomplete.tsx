import { useEffect, useRef, useState } from "react";
import { searchStations, type StationHit } from "@/lib/transitland";
import { MapPin, Loader2 } from "lucide-react";

export function StationAutocomplete({
  value,
  onChange,
  onSelect,
  mode,
  placeholder,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (s: StationHit) => void;
  mode: "train" | "ferry";
  placeholder?: string;
  required?: boolean;
}) {
  const [results, setResults] = useState<StationHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const skipNextRef = useRef(false);

  useEffect(() => {
    if (skipNextRef.current) {
      skipNextRef.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const hits = await searchStations(q, mode);
        setResults(hits);
        setHighlight(0);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [value, mode]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const choose = (s: StationHit) => {
    skipNextRef.current = true;
    onChange(s.name);
    onSelect(s);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        onKeyDown={(e) => {
          if (!open || !results.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, results.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); choose(results[highlight]); }
          else if (e.key === "Escape") setOpen(false);
        }}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-xl border border-input bg-input/50 px-4 py-3 pr-9 text-sm outline-none focus:border-primary"
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-border bg-popover shadow-xl">
          {results.map((r, i) => (
            <li key={`${r.osmType}-${r.osmId}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(r)}
                className={`flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition ${
                  i === highlight ? "bg-accent" : "hover:bg-accent/60"
                }`}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{r.kind}{r.label !== r.name ? ` · ${r.label.split(" · ")[1] ?? ""}` : ""}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !loading && value.trim().length >= 2 && results.length === 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-border bg-popover px-3 py-2.5 text-xs text-muted-foreground shadow-xl">
          No matching {mode === "ferry" ? "ferry terminals" : "stations"} found.
        </div>
      )}
    </div>
  );
}
