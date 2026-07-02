import type { Tables } from "@/integrations/supabase/types";
import type { TripMode } from "@/lib/modes";
import { isAdventure } from "@/lib/modes";
import { Award, Flame, Map, Mountain, Ship, Sparkles, Train, Trophy, Zap, type LucideIcon } from "lucide-react";

type Trip = Tables<"trips">;

export type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string; // hex
  earned: (trips: Trip[]) => boolean;
};

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_trip",
    title: "First Trip",
    description: "You logged your very first journey.",
    icon: Sparkles,
    color: "#a78bfa",
    earned: (t) => t.length >= 1,
  },
  {
    id: "first_train",
    title: "All Aboard",
    description: "Your first train ride is on the books.",
    icon: Train,
    color: "#a78bfa",
    earned: (t) => t.some((x) => x.mode === "train"),
  },
  {
    id: "first_ferry",
    title: "Sea Legs",
    description: "Your first ferry crossing — bon voyage.",
    icon: Ship,
    color: "#60a5fa",
    earned: (t) => t.some((x) => x.mode === "ferry"),
  },
  {
    id: "first_adventure",
    title: "Off the Rails",
    description: "Your first adventure activity logged.",
    icon: Mountain,
    color: "#84cc16",
    earned: (t) => t.some((x) => isAdventure(x.mode as TripMode)),
  },
  {
    id: "first_taxi",
    title: "Hit the Road",
    description: "Your first Drive trip logged.",
    icon: Zap,
    color: "#fb923c",
    earned: (t) => t.some((x) => x.mode === "taxi"),
  },
  {
    id: "ten_trips",
    title: "10 Trips Logged",
    description: "Double digits. You're a regular now.",
    icon: Trophy,
    color: "#f59e0b",
    earned: (t) => t.length >= 10,
  },
  {
    id: "fifty_trips",
    title: "50 Trips Logged",
    description: "Half a century of journeys.",
    icon: Trophy,
    color: "#f59e0b",
    earned: (t) => t.length >= 50,
  },
  {
    id: "hundred_trips",
    title: "Century Club",
    description: "100 trips logged. Incredible.",
    icon: Trophy,
    color: "#fbbf24",
    earned: (t) => t.length >= 100,
  },
  {
    id: "100km",
    title: "100 km Traveled",
    description: "You've moved 100 kilometers in total.",
    icon: Map,
    color: "#22d3ee",
    earned: (t) => totalKm(t) >= 100,
  },
  {
    id: "1000km",
    title: "1,000 km Traveled",
    description: "A thousand kilometers across your trips.",
    icon: Map,
    color: "#22d3ee",
    earned: (t) => totalKm(t) >= 1000,
  },
  {
    id: "10000km",
    title: "10,000 km Traveled",
    description: "Globetrotter status unlocked.",
    icon: Award,
    color: "#ec4899",
    earned: (t) => totalKm(t) >= 10000,
  },
  {
    id: "streak_3",
    title: "3-Day Streak",
    description: "Three days in a row logging trips.",
    icon: Flame,
    color: "#f97316",
    earned: (t) => bestStreak(t) >= 3,
  },
  {
    id: "streak_7",
    title: "7-Day Streak",
    description: "A full week of trips — on fire.",
    icon: Flame,
    color: "#ef4444",
    earned: (t) => bestStreak(t) >= 7,
  },
];

function totalKm(trips: Trip[]) {
  return trips.reduce((s, t) => s + (t.distance_km ?? 0), 0);
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function bestStreak(trips: Trip[]): number {
  if (!trips.length) return 0;
  const days = Array.from(new Set(trips.map((t) => dayKey(t.start_time)))).map(
    (k) => {
      const [y, m, d] = k.split("-").map(Number);
      return new Date(y, m, d).getTime();
    },
  ).sort((a, b) => a - b);
  let best = 1, cur = 1;
  const DAY = 86400000;
  for (let i = 1; i < days.length; i++) {
    if (days[i] - days[i - 1] === DAY) {
      cur++;
      best = Math.max(best, cur);
    } else if (days[i] !== days[i - 1]) {
      cur = 1;
    }
  }
  return best;
}

export function currentStreak(trips: Trip[]): number {
  if (!trips.length) return 0;
  const dayKeys = new Set(trips.map((t) => dayKey(t.start_time)));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let count = 0;
  const cursor = new Date(today);
  // If user hasn't logged today, allow yesterday as the start (don't break streak mid-day).
  if (!dayKeys.has(dayKey(cursor.toISOString()))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!dayKeys.has(dayKey(cursor.toISOString()))) return 0;
  }
  while (dayKeys.has(dayKey(cursor.toISOString()))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

const LS_KEY = "railog.achievements.seen";

export function getSeenAchievements(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(LS_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export function markAchievementsSeen(ids: string[]) {
  if (typeof window === "undefined") return;
  const seen = getSeenAchievements();
  ids.forEach((id) => seen.add(id));
  localStorage.setItem(LS_KEY, JSON.stringify([...seen]));
}

export function earnedAchievements(trips: Trip[]): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.earned(trips));
}

export function newlyEarnedAchievements(trips: Trip[]): Achievement[] {
  const seen = getSeenAchievements();
  return earnedAchievements(trips).filter((a) => !seen.has(a.id));
}
