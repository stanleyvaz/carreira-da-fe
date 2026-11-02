import { RING_COLORS } from "@/lib/theme";

type W = { reflections: number; steps: number; activities: number };
const META: { key: keyof W; label: string }[] = [
  { key: "reflections", label: "Palavra" }, { key: "steps", label: "Aprender" }, { key: "activities", label: "Exercitar" },
];
/** Anéis semanais (estilo Fitness). Metas flexíveis: não há penalidade por não fechar um anel. */
export function Rings({ week, goals, size = 150 }: { week: W; goals: W; size?: number }) {
  const sw = size * 0.095, gap = sw * 0.35;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
      aria-label={META.map((m) => `${m.label}: ${week[m.key]} de ${goals[m.key]}`).join(". ")}>
      {META.map((m, i) => {
        const r = size / 2 - sw / 2 - i * (sw + gap), C = 2 * Math.PI * r;
        const pct = Math.min(1, week[m.key] / goals[m.key]);
        return <g key={m.key} transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={RING_COLORS[m.key]} strokeOpacity=".18" strokeWidth={sw} />
          {pct > 0 && <circle className="ring" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={RING_COLORS[m.key]} strokeWidth={sw} strokeLinecap="round"
            strokeDasharray={C} style={{ ["--c" as string]: C, ["--o" as string]: C * (1 - pct) } as React.CSSProperties} />}
        </g>;
      })}
    </svg>
  );
}
export function RingLegend({ week, goals }: { week: W; goals: W }) {
  return <div className="legend">{META.map((m) => (
    <div key={m.key} className="legrow"><i style={{ background: RING_COLORS[m.key] }} />
      <div><div className="small muted">{m.label}</div>
        <div className="legval" style={{ color: RING_COLORS[m.key] }}>{week[m.key]}<span className="muted">/{goals[m.key]}</span></div></div></div>))}</div>;
}

export function RingLegendInline({ week, goals }: { week: W; goals: W }) {
  return <div className="legend-inline">{META.map((m) => <div key={m.key}><span className="small muted">{m.label}</span>
    <b style={{ color: RING_COLORS[m.key] }}> {week[m.key]}</b><span className="small muted">/{goals[m.key]}</span></div>)}</div>;
}
