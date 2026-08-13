import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { haversineKm } from "@/lib/geo";

type LatLng = [number, number];

/** Base time (ms) to traverse the whole route at 1x. */
const BASE_DURATION_MS = 24_000;
export const PLAYBACK_SPEEDS = [0.5, 1, 2, 4, 8];

function cumulative(path: LatLng[]) {
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + haversineKm(path[i - 1], path[i]));
  return cum;
}

function pointAt(path: LatLng[], cum: number[], t: number): LatLng {
  const total = cum[cum.length - 1];
  if (!total) return path[0];
  const target = total * Math.min(Math.max(t, 0), 1);
  let i = 1;
  while (i < cum.length - 1 && cum[i] < target) i++;
  const segLen = cum[i] - cum[i - 1] || 1;
  const f = (target - cum[i - 1]) / segLen;
  const a = path[i - 1];
  const b = path[i];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

/** Animates a dot along `path`. Returns the current position plus controls. */
export function usePlayback(path: LatLng[]) {
  const enabled = path.length >= 2;
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const raf = useRef<number | null>(null);
  const last = useRef(0);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const cum = useMemo(() => cumulative(path), [path]);

  useEffect(() => {
    if (!playing || !enabled) return;
    last.current = performance.now();
    const step = (now: number) => {
      const dt = now - last.current;
      last.current = now;
      setProgress((p) => {
        const next = p + (dt * speedRef.current) / BASE_DURATION_MS;
        if (next >= 1) {
          setPlaying(false);
          return 1;
        }
        return next;
      });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [playing, enabled]);

  const position = enabled && (playing || progress > 0) ? pointAt(path, cum, progress) : null;
  const distanceKm = (cum[cum.length - 1] ?? 0) * progress;

  return {
    enabled,
    playing,
    speed,
    setSpeed,
    progress,
    position,
    distanceKm,
    seek: (t: number) => setProgress(Math.min(Math.max(t, 0), 1)),
    toggle: () =>
      setPlaying((p) => {
        if (!p && progress >= 1) setProgress(0);
        return !p;
      }),
    reset: () => {
      setPlaying(false);
      setProgress(0);
    },
  };
}

export function PlaybackControls({
  color,
  playing,
  speed,
  progress,
  distanceKm,
  onToggle,
  onReset,
  onSpeed,
  onSeek,
}: {
  color: string;
  playing: boolean;
  speed: number;
  progress: number;
  distanceKm: number;
  onToggle: () => void;
  onReset: () => void;
  onSpeed: (s: number) => void;
  onSeek: (t: number) => void;
}) {
  return (
    <div
      className="mt-3 rounded-3xl border border-white/[0.06] bg-card p-4"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label={playing ? "Pause playback" : "Play trip"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white active:scale-95"
          style={{ background: color, boxShadow: `0 8px 22px -8px ${color}` }}
        >
          {playing ? (
            <Pause className="h-5 w-5" strokeWidth={2.75} />
          ) : (
            <Play className="h-5 w-5 translate-x-[1px]" strokeWidth={2.75} />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(progress * 1000)}
            onChange={(e) => onSeek(Number(e.target.value) / 1000)}
            aria-label="Playback position"
            className="w-full accent-primary"
            style={{ accentColor: color }}
          />
          <div className="mt-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
            <span>Playback</span>
            <span className="font-mono tabular-nums">
              {distanceKm.toFixed(distanceKm < 10 ? 2 : 1)} km
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          aria-label="Restart playback"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] text-muted-foreground"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1 rounded-2xl border border-white/[0.06] bg-background p-1">
        {PLAYBACK_SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSpeed(s)}
            className={`rounded-xl py-1.5 text-[11px] font-bold transition ${
              s === speed ? "text-white" : "text-muted-foreground hover:text-foreground"
            }`}
            style={s === speed ? { background: color } : undefined}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}
