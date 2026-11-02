import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listJourneys, listResources, listTopics } from "@/lib/services/user";
import SaibaMais from "@/components/SaibaMais";
import { AUDIENCES, AUDIENCE_LABEL, type Audience } from "@jornada/shared";
import { gradientFor } from "@/lib/theme";
export default async function Aprender({ searchParams }: { searchParams: Promise<{ tema?: string; publico?: string }> }) {
  const u = await requireUser(); const { tema, publico } = await searchParams;
  const aud = AUDIENCES.find((a) => a === publico);
  const [topics, journeys] = await Promise.all([listTopics(), listJourneys(u.id, tema)]);
  const more = await listResources({ topic: tema, audience: aud, limit: 8 });
  const going = (journeys as any[]).filter((j) => j.doneSteps > 0 && j.doneSteps < j.totalSteps);
  const rest = (journeys as any[]).filter((j) => !going.includes(j));
  const card = (j: any) => j.lock?.locked ? <div key={j.id} className="card trail" aria-disabled="true" style={{ opacity: 0.7 }}>
    <div className="tile" style={{ background: "var(--surface-2, #3a3a3c)" }} aria-hidden>🔒</div>
    <div style={{ flex: 1 }}><span className="small muted">Desafio · {j.topicName} · {j.days} dias</span><h3>{j.title}</h3>
      <p className="small" style={{ margin: 0 }}>🔒 {j.lock.reason}</p></div></div> : <Link key={j.id} href={`/aprender/${j.id}`} className="card link trail">
    <div className="tile" style={{ background: gradientFor(j.topicSlug) }} aria-hidden>{j.topicName[0]}</div>
    <div style={{ flex: 1 }}><span className="small muted">{j.topicName} · {j.days} dias</span><h3>{j.title}</h3>
      {j.summary && <p className="muted small" style={{ margin: 0 }}>{j.summary}</p>}
      {j.totalSteps > 0 && <div className="progress" aria-label={`${j.doneSteps} de ${j.totalSteps} etapas`}><i style={{ width: `${(j.doneSteps / j.totalSteps) * 100}%` }} /></div>}</div></Link>;
  return <div className="fade"><h1>Aprender</h1><p className="muted">Trilhas curtas por tema. Comece onde fizer sentido.</p>
    <div className="scroller" role="navigation" aria-label="Temas">
      <Link className="chip" href="/aprender" aria-pressed={!tema}>Todos</Link>
      {topics.map((t: any) => <Link key={t.slug} className="chip" href={`/aprender?tema=${t.slug}`} aria-pressed={tema === t.slug}>{t.name}</Link>)}</div>
    <div className="scroller" role="navigation" aria-label="Público">
      <Link className="chip" href={tema ? `/aprender?tema=${tema}` : "/aprender"} aria-pressed={!aud}>Para todos</Link>
      {AUDIENCES.filter((a) => a !== "geral").map((a) => <Link key={a} className="chip" href={`/aprender?${tema ? `tema=${tema}&` : ""}publico=${a}`} aria-pressed={aud === a}>{AUDIENCE_LABEL[a as Audience]}</Link>)}</div>
    {journeys.length === 0 && <div className="card"><p>Nenhuma jornada publicada neste tema ainda.</p></div>}
    {going.length > 0 && <><div className="sectionh"><h2>Em andamento</h2></div>{going.map(card)}</>}
    <SaibaMais items={more as any} title={aud ? `Para ${AUDIENCE_LABEL[aud].toLowerCase()}` : "Ouvir e ler mais"} />
    {rest.length > 0 && <><div className="sectionh"><h2>{going.length ? "Explorar" : "Jornadas"}</h2></div>{rest.map(card)}</>}
  </div>;
}
