import { useEffect, useState } from "react";
import type { Tables } from "@/integrations/supabase/types";
import {
  type Achievement,
  markAchievementsSeen,
  newlyEarnedAchievements,
} from "@/lib/achievements";

type Trip = Tables<"trips">;

export function useAchievementQueue(trips: Trip[] | null) {
  const [queue, setQueue] = useState<Achievement[]>([]);
  const [current, setCurrent] = useState<Achievement | null>(null);

  useEffect(() => {
    if (!trips) return;
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
