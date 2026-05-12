import { Link, useLocation } from "@tanstack/react-router";
import { Home, Plus, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const loc = useLocation();
  const items = [
    { to: "/", icon: Home, label: "Trips" },
    { to: "/new", icon: Plus, label: "Log", primary: true },
    { to: "/stats", icon: BarChart3, label: "Stats" },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-md items-center justify-around px-4 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        {items.map((it) => {
          const active = loc.pathname === it.to;
          const Icon = it.icon;
          if (it.primary) {
            return (
              <Link
                key={it.to}
                to={it.to}
                className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95"
                aria-label={it.label}
              >
                <Icon className="h-6 w-6" strokeWidth={2.5} />
              </Link>
            );
          }
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
