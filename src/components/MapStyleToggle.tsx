import { Layers, Moon, Map as MapIcon } from "lucide-react";

export type MapStyle = "satellite" | "dark" | "road";

const OPTIONS: { value: MapStyle; label: string; title: string; Icon: typeof Layers }[] = [
  { value: "satellite", label: "Sat", title: "Satellite", Icon: Layers },
  { value: "road", label: "Road", title: "Standard road map", Icon: MapIcon },
  { value: "dark", label: "Dark", title: "Dark", Icon: Moon },
];

export function MapStyleToggle({
  value,
  onChange,
}: {
  value: MapStyle;
  onChange: (v: MapStyle) => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-full border border-white/[0.08] bg-card/85 p-0.5 backdrop-blur-xl shadow-lg">
      {OPTIONS.map(({ value: v, label, title, Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-label={title}
          title={title}
          className={`flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-bold uppercase tracking-wider transition ${
            value === v
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
          {label}
        </button>
      ))}
    </div>
  );
}
