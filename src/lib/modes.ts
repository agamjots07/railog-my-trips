import { Train, Ship, Car, Waves, Truck, Mountain, Zap, Bus, type LucideIcon } from "lucide-react";

export type TripMode =
  | "train"
  | "ferry"
  | "taxi"
  | "driver"
  | "passenger"
  | "bus"
  | "jetski"
  | "atv"
  | "skateboard"
  | "gondola";

export type Category = "train" | "ferry" | "driver" | "passenger" | "bus" | "adventure";

export const ADVENTURE_SUBTYPES: TripMode[] = ["jetski", "atv", "skateboard", "gondola"];

export const MODE_LABEL: Record<TripMode, string> = {
  train: "Train",
  ferry: "Ferry",
  taxi: "Passenger",
  driver: "Driver",
  passenger: "Passenger",
  bus: "Bus",
  jetski: "Jet Ski",
  atv: "ATV",
  skateboard: "Skateboard",
  gondola: "Gondola",
};

export const MODE_ICON: Record<TripMode, LucideIcon> = {
  train: Train,
  ferry: Ship,
  taxi: Car,
  driver: Car,
  passenger: Car,
  bus: Bus,
  jetski: Waves,
  atv: Truck,
  skateboard: Zap,
  gondola: Mountain,
};

// Hex colors used on the Journey Map and trip detail maps.
export const MODE_COLOR: Record<TripMode, string> = {
  train: "#a78bfa",      // purple
  ferry: "#60a5fa",      // blue
  taxi: "#fb923c",       // orange
  get driver() { return typeof window === "undefined" ? MODE_COLOR.atv : getComputedStyle(document.documentElement).getPropertyValue("--driver").trim() || MODE_COLOR.atv; },
  get passenger() { return typeof window === "undefined" ? MODE_COLOR.taxi : getComputedStyle(document.documentElement).getPropertyValue("--passenger").trim() || MODE_COLOR.taxi; },
  bus: "#f43f5e",        // rose
  jetski: "#22d3ee",     // cyan
  atv: "#84cc16",        // lime
  skateboard: "#ec4899", // pink
  gondola: "#f59e0b",    // amber
};

// Live-only modes don't search stations; they record GPS.
export const LIVE_ONLY_MODES: TripMode[] = ["taxi", "driver", "passenger", "jetski", "atv", "skateboard", "gondola"];

export const TRIP_MODES = Object.keys(MODE_LABEL).filter((m) => m !== "taxi") as TripMode[];

export function roadRole(mode: string): "driver" | "passenger" | null {
  if (mode === "driver") return "driver";
  if (mode === "passenger" || mode === "taxi") return "passenger";
  return null;
}

export function isRoadMode(mode: string): boolean {
  return roadRole(mode) !== null;
}

export function showsGarage(mode: string): boolean {
  return roadRole(mode) === "passenger";
}

export function matchesRoadFilter(mode: string, filter: "both" | "driver" | "passenger"): boolean {
  const role = roadRole(mode);
  return role !== null && (filter === "both" || role === filter);
}

export function isLiveOnly(mode: TripMode): boolean {
  return LIVE_ONLY_MODES.includes(mode);
}

export function isAdventure(mode: TripMode): boolean {
  return ADVENTURE_SUBTYPES.includes(mode);
}

export function categoryOf(mode: TripMode): Category {
  if (mode === "taxi") return "passenger";
  if (mode === "train" || mode === "ferry" || mode === "driver" || mode === "passenger" || mode === "bus") return mode;
  return "adventure";
}
