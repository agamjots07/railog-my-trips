// Fun real-world distance comparisons. Returns the best 3 to show.

type Comparison =
  | { kind: "between"; label: string; km: number }
  | { kind: "loop"; label: string; km: number }
  | { kind: "landmark"; label: string; km: number };

const REFS: Comparison[] = [
  // Iconic city-to-city routes
  { kind: "between", label: "Toronto → Montreal", km: 541 },
  { kind: "between", label: "New York → Boston", km: 346 },
  { kind: "between", label: "London → Paris", km: 460 },
  { kind: "between", label: "Tokyo → Osaka", km: 515 },
  { kind: "between", label: "Sydney → Melbourne", km: 878 },
  { kind: "between", label: "San Francisco → Los Angeles", km: 615 },
  { kind: "between", label: "Vancouver → Calgary", km: 970 },
  // Long hauls
  { kind: "between", label: "Toronto → Vancouver", km: 4380 },
  { kind: "between", label: "London → Rome", km: 1430 },
  { kind: "between", label: "New York → Miami", km: 2030 },
  // Loops around cities
  { kind: "loop", label: "around downtown Toronto", km: 12 },
  { kind: "loop", label: "around Manhattan", km: 51 },
  { kind: "loop", label: "around the Vegas Strip", km: 7 },
  // Iconic landmarks
  { kind: "landmark", label: "the length of the Las Vegas Monorail", km: 6.3 },
  { kind: "landmark", label: "the Toronto Subway Line 1 end-to-end", km: 38.8 },
  { kind: "landmark", label: "the entire London Underground network", km: 402 },
  // Earth-scale
  { kind: "landmark", label: "the way around Earth's equator", km: 40075 },
  { kind: "landmark", label: "the distance to the Moon", km: 384400 },
];

export type FunComparison = {
  label: string;
  detail: string;
};

export function distanceComparisons(totalKm: number): FunComparison[] {
  if (totalKm <= 0) return [];
  const out: FunComparison[] = [];

  // Pick a "between" — closest match where total >= 1x the route, give a "x times" framing
  const betweens = REFS.filter((r) => r.kind === "between" && totalKm >= r.km * 0.4);
  const between = betweens.sort((a, b) => Math.abs(totalKm - a.km) - Math.abs(totalKm - b.km))[0];
  if (between) {
    const times = totalKm / between.km;
    if (times >= 0.85 && times <= 1.15) {
      out.push({
        label: `Toronto → Montreal equivalent`.replace("Toronto → Montreal", between.label),
        detail: `You've covered the same ground as ${between.label}.`,
      });
    } else if (times >= 1.15) {
      out.push({
        label: `${times.toFixed(1)}× ${between.label}`,
        detail: `That's ${between.label} — ${times.toFixed(1)} times over.`,
      });
    } else {
      const pct = Math.round(times * 100);
      out.push({
        label: `${pct}% of ${between.label}`,
        detail: `You're ${pct}% of the way from ${between.label}.`,
      });
    }
  }

  // Pick a loop where times >= 1
  const loop = REFS.filter((r) => r.kind === "loop" && totalKm >= r.km)
    .sort((a, b) => b.km - a.km)[0];
  if (loop) {
    const times = Math.floor(totalKm / loop.km);
    out.push({
      label: `${times}× ${loop.label}`,
      detail: `Like circling ${loop.label} ${times} ${times === 1 ? "time" : "times"}.`,
    });
  }

  // Pick a landmark
  const landmark = REFS.filter((r) => r.kind === "landmark" && totalKm >= r.km * 0.05)
    .sort((a, b) => Math.abs(totalKm - a.km) - Math.abs(totalKm - b.km))[0];
  if (landmark) {
    const times = totalKm / landmark.km;
    if (times >= 1) {
      out.push({
        label: `${times.toFixed(times >= 10 ? 0 : 1)}× ${landmark.label}`,
        detail: `Equivalent to ${landmark.label}, ${times.toFixed(1)} times.`,
      });
    } else {
      const pct = Math.round(times * 100);
      out.push({
        label: `${pct}% of ${landmark.label}`,
        detail: `${pct}% of ${landmark.label}.`,
      });
    }
  }

  return out.slice(0, 3);
}
