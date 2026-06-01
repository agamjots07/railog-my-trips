import { Link, useLocation } from "@tanstack/react-router";
import { Home, Plus, BarChart3, Map } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const loc = useLocation();
  const items = [
    { to: "/", icon: Home, label: "Trips" },
    { to: "/map", icon: Map, label: "Map" },
    { to: "/new", icon: Plus, label: "Log", primary: true },
    { to: "/stats", icon: BarChart3, label: "Stats" },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[1000] pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background via-background/80 to-transparent" />
      <div className="relative mx-auto flex max-w-sm items-center justify-around rounded-full border border-white/[0.06] bg-card/80 px-3 py-2 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        {items.map((it) => {
          const active = loc.pathname === it.to;
          const Icon = it.icon;
          if (it.primary) {
            return (
              <Link
                key={it.to}
                to={it.to}
                className="group relative -my-4 flex h-14 w-14 items-center justify-center rounded-full text-primary-foreground transition active:scale-95"
                style={{
                  background: "var(--gradient-primary)",
                  boxShadow: "var(--shadow-glow)",
                }}
                aria-label={it.label}
              >
                <Icon className="h-6 w-6" strokeWidth={2.75} />
              </Link>
            );
          }
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "flex min-w-[60px] flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
