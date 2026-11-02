import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getStep, listBookmarks } from "@/lib/services/user";
import { NoteBox, Passage } from "@/components/Actions";
import StepView from "@/components/StepView";
import { gradientFor } from "@/lib/theme";
import { listJourneys } from "@/lib/services/user";
export default async function Etapa({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser(); const { id } = await params;
  const [s, marks]: any = await Promise.all([getStep(u.id, id), listBookmarks(u.id)]);
  const slug = ((await listJourneys(u.id)) as any[]).find((x) => x.id === s.journeyId)?.topicSlug;
  return <div className="fade">
    <div className="topbar" role="progressbar" aria-valuemin={0} aria-valuemax={s.totalSteps} aria-valuenow={s.position}><i style={{ width: `${(s.position / Math.max(1, s.totalSteps)) * 100}%` }} /></div>
    <p><Link href={`/aprender/${s.journeyId}`}>← Jornada</Link></p>
    <section className="cover" style={{ background: gradientFor(slug) }}>
      <p className="eyebrow">Dia {s.position} de {s.totalSteps}</p><h1>{s.title}</h1>
      {s.passage && <Passage p={s.passage} bookmarked={marks.some((m: any) => m.passageId === s.passage.id)} />}
    </section>
    <div className="card">
      {s.context && <><h3>Contexto</h3><p>{s.context}</p></>}
      {s.explanation && <><h3>Explicação</h3><p>{s.explanation}</p></>}
      {s.application && <><h3>No cotidiano</h3><p>{s.application}</p></>}
      {s.audioUrl && <audio controls preload="none" src={s.audioUrl} style={{ width: "100%" }} />}
    </div>
    <StepView step={s} />
    {s.done && s.extra && <div className="card"><h3>Para ir além</h3><p>{s.extra}</p></div>}
    {s.songs.length > 0 && <div className="card"><h3>Louvor relacionado</h3>
      {s.songs.map((m: any) => <details key={m.id} style={{ marginBottom: ".5rem" }}><summary>{m.title}</summary>
        <p style={{ whiteSpace: "pre-line", fontFamily: "var(--serif)" }}>{m.lyrics}</p>{m.credits && <p className="small muted">{m.credits}</p>}</details>)}</div>}
    <NoteBox refKind="step" refId={s.id} />
  </div>;
}
