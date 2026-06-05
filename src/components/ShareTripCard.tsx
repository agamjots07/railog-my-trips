import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toPng } from "html-to-image";
import { Download, Share2, X, MapPin } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { MODE_COLOR, MODE_ICON, MODE_LABEL, type TripMode } from "@/lib/modes";
import { fmtDate, fmtDuration } from "@/lib/geo";
import { toast } from "sonner";

type Trip = Tables<"trips">;
type LatLng = [number, number];

function staticRoutePath(path: LatLng[], w: number, h: number) {
  if (path.length < 2) return "";
  const lats = path.map((p) => p[0]);
  const lngs = path.map((p) => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const pad = 12;
  const dLat = maxLat - minLat || 0.0001;
  const dLng = maxLng - minLng || 0.0001;
  const sx = (w - pad * 2) / dLng;
  const sy = (h - pad * 2) / dLat;
  const s = Math.min(sx, sy);
  const ox = (w - dLng * s) / 2;
  const oy = (h - dLat * s) / 2;
  return path
    .map((p, i) => {
      const x = ox + (p[1] - minLng) * s;
      const y = oy + (maxLat - p[0]) * s; // flip
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export function ShareTripCard({
  trip,
  path,
  onClose,
}: {
  trip: Trip;
  path: LatLng[];
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const mode = trip.mode as TripMode;
  const Icon = MODE_ICON[mode] ?? MODE_ICON.train;
  const color = MODE_COLOR[mode] ?? MODE_COLOR.train;
  const title = trip.route_name || `${trip.origin} → ${trip.destination}`;
  const distance = trip.distance_km ? `${trip.distance_km.toFixed(trip.distance_km < 10 ? 1 : 0)}` : "—";
  const duration = fmtDuration(trip.start_time, trip.end_time);
  const W = 540, H = 320;
  const d = staticRoutePath(path, W, H);

  const generate = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    const dataUrl = await toPng(cardRef.current, {
      pixelRatio: 3,
      cacheBust: true,
      backgroundColor: "#0a0a0f",
    });
    const res = await fetch(dataUrl);
    return await res.blob();
  };

  const download = async () => {
    try {
      setBusy(true);
      const blob = await generate();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `railog-${title.replace(/\s+/g, "-").toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Saved to downloads");
    } catch (e) {
      toast.error("Couldn't save image");
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    try {
      setBusy(true);
      const blob = await generate();
      if (!blob) return;
      const file = new File([blob], `railog-${trip.id}.png`, { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({
          files: [file],
          title: "Railog",
          text: `${title} — ${distance} km on Railog`,
        });
      } else {
        await download();
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        toast.error("Couldn't share");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[120] flex flex-col bg-background/90 backdrop-blur-lg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),1rem)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Share trip
          </p>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.06] bg-card/60 text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center px-5">
          <motion.div
            initial={{ scale: 0.85, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 240, damping: 22 }}
            className="w-full max-w-sm"
          >
            {/* THE SHAREABLE CARD */}
            <div
              ref={cardRef}
              className="relative overflow-hidden rounded-[28px] p-6 text-white"
              style={{
                background:
                  "linear-gradient(155deg, #14141d 0%, #0a0a0f 60%, #0a0a0f 100%)",
                boxShadow: `0 30px 80px -20px ${color}66, 0 0 0 1px rgba(255,255,255,0.06) inset`,
              }}
            >
              <div
                className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full opacity-40 blur-3xl"
                style={{ background: color }}
              />

              {/* Header */}
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-white/80" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/70">
                    Railog
                  </p>
                </div>
                <div
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: `${color}25`, color }}
                >
                  <Icon className="h-3 w-3" strokeWidth={3} />
                  {MODE_LABEL[mode] ?? mode}
                </div>
              </div>

              {/* Title */}
              <h2 className="relative mt-4 text-[22px] font-bold leading-tight tracking-tight">
                {title}
              </h2>
              <div className="relative mt-1 flex items-center gap-1.5 text-xs text-white/60">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{trip.origin}</span>
                <span>→</span>
                <span className="truncate">{trip.destination}</span>
              </div>

              {/* Map */}
              <div
                className="relative mt-5 overflow-hidden rounded-2xl"
                style={{
                  background: "linear-gradient(135deg, #1a1a26, #0f0f17)",
                  height: 160,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {/* grid */}
                <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M40 0H0V40" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                    </pattern>
                    <filter id="rg" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="b" />
                      <feMerge>
                        <feMergeNode in="b" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                  {d && (
                    <>
                      <path d={d} stroke={color} strokeOpacity="0.25" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      <path d={d} stroke={color} strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" filter="url(#rg)" />
                    </>
                  )}
                </svg>
                {!d && (
                  <div className="flex h-full items-center justify-center text-[11px] uppercase tracking-wider text-white/40">
                    No route geometry
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="relative mt-5 grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/50">Distance</p>
                  <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums">
                    {distance}
                    <span className="ml-1 text-xs font-semibold text-white/50">km</span>
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/50">Duration</p>
                  <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums">{duration}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/50">Date</p>
                  <p className="mt-1.5 font-mono text-sm font-bold tabular-nums leading-tight pt-2">
                    {fmtDate(trip.start_time)}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-2 gap-3 px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-4">
          <button
            onClick={download}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-card py-3.5 text-sm font-bold transition active:scale-[0.98] disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Save
          </button>
          <button
            onClick={share}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground transition active:scale-[0.98] disabled:opacity-50"
            style={{ boxShadow: "var(--shadow-glow)" }}
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
