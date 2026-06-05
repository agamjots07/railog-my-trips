import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

export function EmptyState({
  icon: Icon,
  eyebrow,
  title,
  body,
  ctaLabel,
  ctaTo,
  color = "var(--gradient-primary)",
  glow = "var(--shadow-glow)",
}: {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaTo?: string;
  color?: string;
  glow?: string;
}) {
  return (
    <div className="relative mt-10 flex flex-col items-center px-4 text-center">
      {/* Decorative concentric rings */}
      <div className="relative mb-6 flex h-36 w-36 items-center justify-center">
        <div
          className="absolute inset-0 rounded-full opacity-30 blur-2xl"
          style={{ background: color }}
        />
        <div className="absolute inset-3 rounded-full border border-white/[0.06]" />
        <div className="absolute inset-7 rounded-full border border-white/[0.08]" />
        <div
          className="relative flex h-20 w-20 items-center justify-center rounded-3xl"
          style={{ background: color, boxShadow: glow }}
        >
          <Icon className="h-10 w-10 text-primary-foreground" strokeWidth={2.3} />
        </div>
      </div>

      {eyebrow && (
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-2 text-2xl font-bold tracking-tight">{title}</h2>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>

      {ctaLabel && ctaTo && (
        <Link
          to={ctaTo}
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98]"
          style={{ boxShadow: "var(--shadow-glow)" }}
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
