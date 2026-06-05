import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import type { Achievement } from "@/lib/achievements";

export function AchievementCelebration({
  achievement,
  onClose,
}: {
  achievement: Achievement | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!achievement) return;
    const color = achievement.color;
    const burst = () => {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.4 },
        colors: [color, "#ffffff", "#fde68a"],
      });
    };
    burst();
    const t = setTimeout(burst, 250);
    return () => clearTimeout(t);
  }, [achievement]);

  return (
    <AnimatePresence>
      {achievement && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-background/85 backdrop-blur-md" />
          <motion.div
            className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/[0.08] bg-card p-7 text-center"
            style={{ boxShadow: "0 30px 80px -20px rgba(0,0,0,0.7)" }}
            initial={{ scale: 0.6, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full opacity-40 blur-3xl"
              style={{ background: achievement.color }}
            />
            <p className="relative text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
              Achievement unlocked
            </p>
            <motion.div
              className="relative mx-auto mt-5 flex h-24 w-24 items-center justify-center rounded-3xl"
              style={{
                background: achievement.color,
                boxShadow: `0 20px 50px -10px ${achievement.color}80`,
              }}
              initial={{ rotate: -15, scale: 0.5 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.1 }}
            >
              <achievement.icon className="h-12 w-12 text-white" strokeWidth={2.5} />
            </motion.div>
            <h2 className="relative mt-5 text-2xl font-bold tracking-tight">
              {achievement.title}
            </h2>
            <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">
              {achievement.description}
            </p>
            <button
              onClick={onClose}
              className="relative mt-6 w-full rounded-2xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground transition active:scale-[0.98]"
              style={{ boxShadow: "var(--shadow-glow)" }}
            >
              Nice
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
