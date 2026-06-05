import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Train, Map, Trophy, Sparkles, ArrowRight } from "lucide-react";

const LS_KEY = "railog.onboarded.v1";

const SLIDES = [
  {
    icon: Train,
    color: "#a78bfa",
    eyebrow: "Welcome to Railog",
    title: "Every journey,\nlogged beautifully.",
    body: "Track every train, ferry, taxi and adventure you take — in one elegant timeline.",
  },
  {
    icon: Map,
    color: "#22d3ee",
    eyebrow: "Your world, drawn",
    title: "See your routes\non a living map.",
    body: "Each trip you log adds a colored line to your personal world map. Watch it grow.",
  },
  {
    icon: Trophy,
    color: "#f59e0b",
    eyebrow: "Milestones & streaks",
    title: "Earn rewards\nfor moving.",
    body: "Unlock achievements, build streaks, and beat your personal records along the way.",
  },
  {
    icon: Sparkles,
    color: "#ec4899",
    eyebrow: "Ready when you are",
    title: "Let's log your\nfirst trip.",
    body: "Train, ferry, taxi, jet ski — anything goes. Your journey starts now.",
  },
];

export function Onboarding() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(LS_KEY)) setOpen(true);
  }, []);

  const finish = () => {
    localStorage.setItem(LS_KEY, "1");
    setOpen(false);
  };

  if (!open) return null;
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  const Icon = s.icon;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex flex-col bg-background"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[60%]"
          style={{
            background: `radial-gradient(80% 60% at 50% 0%, ${s.color}30, transparent 70%)`,
          }}
        />

        <div className="flex items-center justify-between px-6 pt-[max(env(safe-area-inset-top),1.25rem)]">
          <div className="flex gap-1.5">
            {SLIDES.map((_, idx) => (
              <div
                key={idx}
                className="h-1 w-7 overflow-hidden rounded-full bg-white/10"
              >
                <motion.div
                  className="h-full"
                  style={{ background: s.color }}
                  initial={false}
                  animate={{ width: idx < i ? "100%" : idx === i ? "100%" : "0%" }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            ))}
          </div>
          {!last && (
            <button
              onClick={finish}
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground transition hover:text-foreground"
            >
              Skip
            </button>
          )}
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center px-8 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col items-center"
            >
              <motion.div
                className="flex h-28 w-28 items-center justify-center rounded-[2rem]"
                style={{
                  background: s.color,
                  boxShadow: `0 30px 80px -20px ${s.color}aa`,
                }}
                initial={{ rotate: -10, scale: 0.7 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 220, damping: 16 }}
              >
                <Icon className="h-14 w-14 text-white" strokeWidth={2.3} />
              </motion.div>
              <p
                className="mt-10 text-[11px] font-bold uppercase tracking-[0.3em]"
                style={{ color: s.color }}
              >
                {s.eyebrow}
              </p>
              <h1 className="mt-4 whitespace-pre-line text-[34px] font-bold leading-[1.05] tracking-tight">
                {s.title}
              </h1>
              <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
          <button
            onClick={() => (last ? finish() : setI(i + 1))}
            className="flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-[15px] font-bold text-white transition active:scale-[0.98]"
            style={{
              background: s.color,
              boxShadow: `0 20px 50px -15px ${s.color}aa`,
            }}
          >
            {last ? "Start logging" : "Next"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
