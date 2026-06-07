import { GO_BILEVEL, detectGoLine, type GoLine } from "@/lib/goTrains";

type Props = {
  routeName: string | null;
  /** Optional line long name when known. */
  longName?: string | null;
};

export function GoTrainCard({ routeName, longName }: Props) {
  const line: GoLine = detectGoLine(routeName, longName) ?? {
    code: "GO",
    name: "GO Transit",
    color: "#0f8000",
  };
  const { locomotive, coach } = GO_BILEVEL;

  return (
    <div
      className="mt-5 overflow-hidden rounded-3xl border border-white/[0.06] bg-card"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {/* Header with line color */}
      <div
        className="relative px-5 pb-5 pt-5"
        style={{
          background: `linear-gradient(135deg, ${line.color}, ${line.color}90)`,
        }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
          GO Transit · Rolling Stock
        </p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="rounded-md bg-white/20 px-2 py-0.5 font-mono text-[12px] font-bold text-white backdrop-blur">
            {line.code}
          </span>
          <h3 className="text-[22px] font-bold leading-tight tracking-tight text-white">
            {line.name}
          </h3>
        </div>

        {/* Train silhouette */}
        <div className="mt-4 -mx-2">
          <TrainSilhouette accent={line.color} />
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-white/[0.05] border-t border-white/[0.06]">
        <SpecCell label="Locomotive" title={locomotive.model} sub={locomotive.builder} />
        <SpecCell label="Coach" title={coach.model.replace("Bombardier ", "")} sub={coach.builder} />
      </div>

      <div className="grid grid-cols-3 divide-x divide-white/[0.05] border-t border-white/[0.06]">
        <Stat label="Power" value={locomotive.horsepower} />
        <Stat label="Seats / car" value="162" />
        <Stat label="Since" value={String(coach.yearIntroduced)} />
      </div>

      <div className="space-y-3 border-t border-white/[0.06] px-5 py-4">
        <Fact label="Locomotive" text={locomotive.fact} />
        <Fact label="Coaches" text={coach.fact} />
      </div>
    </div>
  );
}

function SpecCell({ label, title, sub }: { label: string; title: string; sub: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[14px] font-bold leading-tight">{title}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-3 text-center">
      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-[13px] font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Fact({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-[12.5px] leading-relaxed text-foreground/90">{text}</p>
    </div>
  );
}

/**
 * Stylized GO consist: MP40 locomotive + two BiLevel coaches.
 * Uses currentColor for the bodywork; accent for the stripe.
 */
function TrainSilhouette({ accent }: { accent: string }) {
  return (
    <svg
      viewBox="0 0 360 90"
      className="h-[90px] w-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* rails */}
      <line x1="0" y1="78" x2="360" y2="78" stroke="white" strokeOpacity="0.25" strokeWidth="1" />
      <line x1="0" y1="82" x2="360" y2="82" stroke="white" strokeOpacity="0.15" strokeWidth="1" />

      {/* Locomotive (MP40) */}
      <g>
        <path
          d="M8 70 L8 38 L18 28 L62 28 L72 38 L72 70 Z"
          fill="white"
          fillOpacity="0.95"
        />
        {/* cab window */}
        <path d="M20 32 L60 32 L66 40 L20 40 Z" fill={accent} opacity="0.85" />
        {/* side stripe */}
        <rect x="8" y="52" width="64" height="6" fill={accent} />
        {/* headlight */}
        <circle cx="14" cy="46" r="2" fill="#fff200" />
        {/* wheels */}
        <circle cx="20" cy="74" r="5" fill="#1a1a1a" stroke="white" strokeOpacity="0.4" />
        <circle cx="36" cy="74" r="5" fill="#1a1a1a" stroke="white" strokeOpacity="0.4" />
        <circle cx="56" cy="74" r="5" fill="#1a1a1a" stroke="white" strokeOpacity="0.4" />
      </g>

      {/* Coupler */}
      <rect x="72" y="62" width="6" height="3" fill="white" opacity="0.5" />

      {/* BiLevel coach 1 */}
      <BiLevel x={78} accent={accent} />
      {/* Coupler */}
      <rect x="208" y="62" width="6" height="3" fill="white" opacity="0.5" />
      {/* BiLevel coach 2 */}
      <BiLevel x={214} accent={accent} />
      {/* Coupler */}
      <rect x="344" y="62" width="6" height="3" fill="white" opacity="0.5" />
    </svg>
  );
}

function BiLevel({ x, accent }: { x: number; accent: string }) {
  return (
    <g transform={`translate(${x},0)`}>
      {/* body — bilevel is taller */}
      <path
        d="M0 70 L0 22 C0 18 4 14 8 14 L122 14 C126 14 130 18 130 22 L130 70 Z"
        fill="white"
        fillOpacity="0.95"
      />
      {/* upper deck windows */}
      <g fill={accent} opacity="0.85">
        <rect x="6" y="22" width="14" height="10" rx="1.5" />
        <rect x="24" y="22" width="14" height="10" rx="1.5" />
        <rect x="42" y="22" width="14" height="10" rx="1.5" />
        <rect x="60" y="22" width="14" height="10" rx="1.5" />
        <rect x="78" y="22" width="14" height="10" rx="1.5" />
        <rect x="96" y="22" width="14" height="10" rx="1.5" />
        <rect x="114" y="22" width="10" height="10" rx="1.5" />
      </g>
      {/* side stripe */}
      <rect x="0" y="40" width="130" height="5" fill={accent} />
      {/* lower deck windows */}
      <g fill={accent} opacity="0.6">
        <rect x="6" y="50" width="22" height="8" rx="1.5" />
        <rect x="32" y="50" width="22" height="8" rx="1.5" />
        <rect x="58" y="50" width="22" height="8" rx="1.5" />
        <rect x="84" y="50" width="22" height="8" rx="1.5" />
        <rect x="110" y="50" width="14" height="8" rx="1.5" />
      </g>
      {/* wheels */}
      <circle cx="18" cy="74" r="5" fill="#1a1a1a" stroke="white" strokeOpacity="0.4" />
      <circle cx="34" cy="74" r="5" fill="#1a1a1a" stroke="white" strokeOpacity="0.4" />
      <circle cx="96" cy="74" r="5" fill="#1a1a1a" stroke="white" strokeOpacity="0.4" />
      <circle cx="112" cy="74" r="5" fill="#1a1a1a" stroke="white" strokeOpacity="0.4" />
    </g>
  );
}
