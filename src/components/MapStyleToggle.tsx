import { Layers, Moon } from "lucide-react";

export type MapStyle = "satellite" | "dark";

export function MapStyleToggle({
  value,
  onChange,
}: {
  value: MapStyle;
  onChange: (v: MapStyle) => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-full border border-white/[0.08] bg-card/85 p-0.5 backdrop-blur-xl shadow-lg">
      <button
        type="button"
        onClick={() => onChange("satellite")}
        aria-label="Satellite view"
        title="Satellite"
        className={`flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-bold uppercase tracking-wider transition ${
          value === "satellite"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Layers className="h-3.5 w-3.5" strokeWidth={2.5} />
        Sat
      </button>
      <button
        type="button"
        onClick={() => onChange("dark")}
        aria-label="Dark map view"
        title="Dark"
        className={`flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-bold uppercase tracking-wider transition ${
          value === "dark"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Moon className="h-3.5 w-3.5" strokeWidth={2.5} />
        Dark
      </button>
    </div>
  );
}
