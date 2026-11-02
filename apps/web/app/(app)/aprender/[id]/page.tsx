import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getJourney, listJourneys } from "@/lib/services/user";
import { gradientFor } from "@/lib/theme";
export default async function Jornada({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser(); const { id } = await params;
  const j: any = await getJourney(u.id, id);
  const slug = ((await listJourneys(u.id)) as any[]).find((x) => x.id === id)?.topicSlug;
  const done = j.steps.filter((s: any) => s.done).length;
  const next = j.steps.find((s: any) => !s.done);
  return <div className="fade"><p><Link href="/aprender">← Aprender</Link></p>
    <section className="cover" style={{ background: gradientFor(slug) }}>
      <p className="eyebrow">{j.topicName} · {j.days} dias</p><h1>{j.title}</h1>{j.summary && <p>{j.summary}</p>}
      <div className="progress" aria-label={`${done} de ${j.steps.length} etapas`}><i style={{ width: `${(done / Math.max(1, j.steps.length)) * 100}%` }} /></div>
      <p className="small" style={{ marginTop: ".5rem" }}>{done} de {j.steps.length} etapas — no seu ritmo</p>
      {next && !j.pacing?.locked && <Link className="btn" href={`/aprender/etapa/${next.id}`} style={{ background: "#fff", color: "#222", borderColor: "#fff" }}>{done ? "Continuar" : "Começar"}</Link>}
      {next && j.pacing?.locked && <p className="small" role="status" style={{ marginTop: ".75rem" }}>⏳ {j.pacing.reason}</p>}
    </section>
    <nav className="dayrow" aria-label="Dias da jornada">{j.steps.map((s: any) =>
      <Link key={s.id} href={`/aprender/etapa/${s.id}`} className={`daypill ${s.done ? "done" : s.id === next?.id ? "next" : ""}`}>
        <small>DIA</small><b>{s.done ? "✓" : s.position}</b></Link>)}</nav>
    {j.steps.map((s: any) => <Link key={s.id} href={`/aprender/etapa/${s.id}`} className={`card link steprow ${s.done ? "done" : s.id === next?.id ? "next" : ""}`}>
      <span className="n">{s.done ? "✓" : s.position}</span><div><span className="small muted">Dia {s.position}</span><h3 style={{ margin: 0 }}>{s.title}</h3></div></Link>)}
    {done === j.steps.length && j.steps.length > 0 && <div className="card"><h3>Jornada concluída</h3><p>Que bom ter caminhado por aqui. Os conteúdos complementares de cada etapa já estão disponíveis.</p></div>}
  </div>;
}
