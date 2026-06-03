import { Train, Ship, Car, Waves, Bike, Mountain, Zap, type LucideIcon } from "lucide-react";

export type TripMode =
  | "train"
  | "ferry"
  | "taxi"
  | "jetski"
  | "atv"
  | "skateboard"
  | "gondola";

export type Category = "train" | "ferry" | "taxi" | "adventure";

export const ADVENTURE_SUBTYPES: TripMode[] = ["jetski", "atv", "skateboard", "gondola"];

export const MODE_LABEL: Record<TripMode, string> = {
  train: "Train",
  ferry: "Ferry",
  taxi: "Taxi / Uber",
  jetski: "Jet Ski",
  atv: "ATV",
  skateboard: "Skateboard",
  gondola: "Gondola",
};

export const MODE_ICON: Record<TripMode, LucideIcon> = {
  train: Train,
  ferry: Ship,
  taxi: Car,
  jetski: Waves,
  atv: Bike,
  skateboard: Zap,
  gondola: Mountain,
};

// Hex colors used on the Journey Map and trip detail maps.
export const MODE_COLOR: Record<TripMode, string> = {
  train: "#a78bfa",      // purple
  ferry: "#60a5fa",      // blue
  taxi: "#fb923c",       // orange
  jetski: "#22d3ee",     // cyan
  atv: "#84cc16",        // lime
  skateboard: "#ec4899", // pink
  gondola: "#f59e0b",    // amber
};

// Live-only modes don't search stations; they record GPS.
export const LIVE_ONLY_MODES: TripMode[] = ["taxi", "jetski", "atv", "skateboard", "gondola"];

export function isLiveOnly(mode: TripMode): boolean {
  return LIVE_ONLY_MODES.includes(mode);
}

export function isAdventure(mode: TripMode): boolean {
  return ADVENTURE_SUBTYPES.includes(mode);
}

export function categoryOf(mode: TripMode): Category {
  if (mode === "train" || mode === "ferry" || mode === "taxi") return mode;
  return "adventure";
}
