import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { pendingRovyDestinations, finishRovyDestination } from "@/lib/rovy.functions";
import { reverseGeocode } from "@/lib/reverseGeocode";

export function RovyDestinationQueue() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const pending = useServerFn(pendingRovyDestinations), finish = useServerFn(finishRovyDestination);
  useEffect(() => {
    if (!user) return;
    let stopped = false, running = false;
    const run = async () => {
      if (running || stopped) return;
      running = true;
      try {
        const rows = await pending();
        for (const row of rows) {
          if (stopped) break;
          if (row.destination_lat == null || row.destination_lng == null) continue;
          const name = await reverseGeocode([row.destination_lat, row.destination_lng]);
          if (stopped) break;
          if (name) { await finish({ data: { id: row.id, name } }); await queryClient.invalidateQueries({ queryKey: ["trips"] }); }
          await new Promise(resolve => setTimeout(resolve, 1100));
        }
      } catch { /* Persisted queue retries later, never blocks imports. */ }
      finally { running = false; }
    };
    void run();
    const interval = setInterval(() => void run(), 15000);
    return () => { stopped = true; clearInterval(interval); };
  }, [user?.id, pending, finish, queryClient]);
  return null;
}