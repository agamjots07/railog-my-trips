import { useEffect, useState } from "react";
import type { Tables } from "@/integrations/supabase/types";
import {
  type Achievement,
  earnedAchievements,
  getSeenAchievements,
  markAchievementsSeen,
  newlyEarnedAchievements,
} from "@/lib/achievements";

const BOOTSTRAP_KEY = "railog.achievements.bootstrapped";

type Trip = Tables<"trips">;

export function useAchievementQueue(trips: Trip[] | null) {
  const [queue, setQueue] = useState<Achievement[]>([]);
  const [current, setCurrent] = useState<Achievement | null>(null);

  useEffect(() => {
    if (!trips) return;
    // First time we ever see this user's trips, silently mark all currently-earned
    // achievements as seen so the user doesn't get a celebration avalanche.
    if (typeof window !== "undefined" && !localStorage.getItem(BOOTSTRAP_KEY)) {
      const seen = getSeenAchievements();
      if (seen.size === 0) {
        markAchievementsSeen(earnedAchievements(trips).map((a) => a.id));
      }
      localStorage.setItem(BOOTSTRAP_KEY, "1");
      return;
    }
    const fresh = newlyEarnedAchievements(trips);
    if (fresh.length) {
      setQueue((q) => [...q, ...fresh]);
      markAchievementsSeen(fresh.map((a) => a.id));
    }
  }, [trips]);

  useEffect(() => {
    if (!current && queue.length) {
      setCurrent(queue[0]);
      setQueue((q) => q.slice(1));
    }
  }, [current, queue]);

  return {
    current,
    dismiss: () => setCurrent(null),
  };
}
