const L = ["D", "S", "T", "Q", "Q", "S", "S"];
/** Últimos 7 dias. Dias sem atividade ficam neutros: nunca marcados como falha. */
export default function WeekStrip({ days }: { days: { day: string; dow: number; active: boolean; today: boolean }[] }) {
  return <ol className="weekstrip" aria-label="Últimos sete dias">{days.map((d) => (
    <li key={d.day} className={`${d.active ? "on" : ""} ${d.today ? "today" : ""}`} aria-label={`${d.day}${d.active ? ", com atividade" : ""}`}>
      <span>{L[d.dow]}</span><b>{d.active ? "✓" : d.day.slice(8)}</b></li>))}</ol>;
}
