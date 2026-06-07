// GO Transit rolling stock + line metadata.

export type GoLine = {
  code: string;
  name: string;
  color: string;
};

const LINES: Record<string, GoLine> = {
  LW: { code: "LW", name: "Lakeshore West", color: "#971b81" },
  LE: { code: "LE", name: "Lakeshore East", color: "#971b81" },
  KI: { code: "KI", name: "Kitchener",      color: "#00853f" },
  MI: { code: "MI", name: "Milton",         color: "#f58220" },
  RH: { code: "RH", name: "Richmond Hill",  color: "#00a4a7" },
  BR: { code: "BR", name: "Barrie",         color: "#f8c20d" },
  ST: { code: "ST", name: "Stouffville",    color: "#794f9b" },
};

const LINE_BY_LONG: Record<string, string> = {
  "lakeshore west": "LW",
  "lakeshore east": "LE",
  "kitchener": "KI",
  "milton": "MI",
  "richmond hill": "RH",
  "barrie": "BR",
  "stouffville": "ST",
};

export type GoConsist = {
  locomotive: {
    model: string;
    builder: string;
    yearIntroduced: number;
    horsepower: string;
    fact: string;
  };
  coach: {
    model: string;
    builder: string;
    yearIntroduced: number;
    capacity: string;
    fact: string;
  };
};

export const GO_BILEVEL: GoConsist = {
  locomotive: {
    model: "MP40PH-3C",
    builder: "MotivePower (Wabtec)",
    yearIntroduced: 2008,
    horsepower: "4,000 hp",
    fact: "GO's primary workhorse — a 4,000 hp diesel-electric that hauls up to 12 BiLevel coaches.",
  },
  coach: {
    model: "Bombardier BiLevel",
    builder: "Bombardier (now Alstom)",
    yearIntroduced: 1978,
    capacity: "162 seats per car",
    fact: "First built for GO in 1978, BiLevels are now used by 12 agencies across North America — the continent's most successful commuter coach.",
  },
};

export function detectGoLine(routeName: string | null, longName?: string | null): GoLine | null {
  if (routeName) {
    const up = routeName.toUpperCase().trim();
    if (LINES[up]) return LINES[up];
  }
  const ln = (longName ?? routeName ?? "").toLowerCase().trim();
  for (const [key, code] of Object.entries(LINE_BY_LONG)) {
    if (ln.includes(key)) return LINES[code];
  }
  return null;
}

export function isGoTrip(originId: string | null, destinationId: string | null): boolean {
  return (originId?.startsWith("go:") ?? false) || (destinationId?.startsWith("go:") ?? false);
}
