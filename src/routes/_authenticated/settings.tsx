import { createFileRoute, Link } from "@tanstack/react-router";
import { Car, ChevronRight, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Railog" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="relative px-5 pt-10">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 -z-10"
        style={{ background: "var(--gradient-hero)" }}
      />

      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Settings
      </p>
      <h1 className="mt-2 text-[34px] font-bold leading-[1.05] tracking-tight">Preferences</h1>

      <div
        className="mt-7 overflow-hidden rounded-3xl border border-white/[0.06] bg-card"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <Link
          to="/garage"
          className="flex items-center gap-4 px-5 py-4 transition active:bg-white/[0.03]"
        >
          <span
            className="flex h-10 w-10 items-center justify-center rounded-2xl text-primary-foreground"
            style={{ background: "linear-gradient(135deg,#fb923c,#f97316)" }}
          >
            <Car className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <div className="flex-1">
            <p className="text-[15px] font-bold">Garage</p>
            <p className="text-xs text-muted-foreground">Manage your vehicles</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>

      <button
        onClick={() => supabase.auth.signOut()}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.06] bg-card py-4 text-sm font-bold text-destructive transition active:scale-[0.98]"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}
