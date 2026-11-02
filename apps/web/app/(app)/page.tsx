import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getPreferences, listBookmarks, getStarter, listJourneys, listResources, todayReflection, weekOverview } from "@/lib/services/user";
import { CompleteButton, NoteBox, Passage } from "@/components/Actions";
import { RingLegendInline, Rings } from "@/components/Rings";
import { inbox } from "@/lib/services/notifications";
import Inbox from "@/components/Inbox";
import SaibaMais from "@/components/SaibaMais";
import { gradientFor } from "@/lib/theme";

function greeting(name?: string | null) {
  const h = +new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" });
  const g = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  return name ? `${g}, ${name}` : g;
}
export default async function Hoje() {
  const u = await requireUser();
  const [r, prefs, journeys, ov, marks] = await Promise.all([todayReflection(u.id) as Promise<any>, getPreferences(u.id) as Promise<any>, listJourneys(u.id), weekOverview(u.id), listBookmarks(u.id)]);
  const news = (await inbox(u.id, 5)).filter((n: any) => !n.read);
  const starter: any = await getStarter(u.id);
  const more = r?.topicSlug ? await listResources({ topic: r.topicSlug, limit: 3 }) : [];
  const current: any = journeys.find((j: any) => j.doneSteps > 0 && j.doneSteps < j.totalSteps) ?? (journeys as any[]).find((j) => j.doneSteps === 0 && !j.lock?.locked);
  const marked = new Set(marks.map((m: any) => m.passageId));
  const date = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });
  return <div className="fade">
    <p className="eyebrow">{date}</p><h1>{greeting(u.displayName)}</h1>
    <p className="muted">Cerca de {prefs?.dailyMinutes ?? 3} min por dia. No seu ritmo.</p>

    <Inbox items={news as any} />

    {ov.welcomeBack && <div className="card" role="status"><h3 style={{ marginTop: 0 }}>Que bom te ver de volta 🙂</h3>
      <p className="muted" style={{ margin: ".25rem 0 .75rem" }}>Sem pressa e sem cobrança. Que tal só um minuto hoje? Comece pelo versículo abaixo.</p></div>}
    {starter && !starter.complete && starter.lockedToday && <div className="card" role="status"><p className="eyebrow">Primeiros 7 dias · {starter.doneSteps} de {starter.totalSteps}</p>
      <h3 style={{ margin: ".15rem 0" }}>Feito por hoje ✓</h3><p className="muted small" style={{ margin: 0 }}>{starter.pacingReason}</p>
      <div className="progress" aria-label={`${starter.doneSteps} de ${starter.totalSteps} dias`}><i style={{ width: `${(starter.doneSteps / Math.max(1, starter.totalSteps)) * 100}%` }} /></div></div>}
    {starter && !starter.complete && !starter.lockedToday && <Link className="card link" href={`/aprender/etapa/${starter.nextStepId}`}>
      <p className="eyebrow">Primeiros 7 dias · dia {starter.day} de {starter.totalSteps}</p>
      <h3 style={{ margin: ".15rem 0" }}>{starter.nextStepTitle}</h3>
      <p className="muted small" style={{ margin: 0 }}>Cerca de 1 minuto. Se faltar um dia, é só voltar de onde parou.</p>
      <div className="progress" aria-label={`${starter.doneSteps} de ${starter.totalSteps} dias`}><i style={{ width: `${(starter.doneSteps / Math.max(1, starter.totalSteps)) * 100}%` }} /></div></Link>}

    <section className="hero compact" aria-label="Sua semana">
      <Rings week={ov.week} goals={ov.goals} size={72} />
      <div style={{ flex: 1 }}><p className="eyebrow" style={{ margin: 0 }}>Sua semana</p><RingLegendInline week={ov.week} goals={ov.goals} />
        {ov.activeDays > 0 && <p className="small muted" style={{ margin: ".25rem 0 0" }}>Com a Palavra em {ov.activeDays} dos últimos 7 dias · sem cobrança</p>}</div>
    </section>

    {r ? <>
      <article className="cover" style={{ background: gradientFor(r.topicSlug) }} aria-label="Versículo do dia">
        <p className="eyebrow">Versículo do dia</p>
        {r.passage ? <Passage p={r.passage} bookmarked={marked.has(r.passage.id)} /> : <h1>{r.title}</h1>}
      </article>
      <article className="card" aria-labelledby="t">
        <h2 id="t">{r.title}</h2><p>{r.body}</p>
        {r.application && <><h3>Para o seu dia</h3><p>{r.application}</p></>}
        {r.question && <><h3>Para refletir</h3><p>{r.question}</p></>}
        {r.audioUrl && <audio controls preload="none" src={r.audioUrl} style={{ width: "100%", marginBottom: "1rem" }} />}
        <CompleteButton url={`/api/reflections/${r.id}/complete`} done={r.done} label="Concluir reflexão" />
      </article>
      <NoteBox refKind="reflection" refId={r.id} />
    </> : <div className="card"><p>Ainda não há reflexão publicada para hoje. Que tal explorar uma jornada?</p></div>}

    <SaibaMais items={more as any} />

    {current && <><div className="sectionh"><h2>{current.doneSteps > 0 ? "Continuar" : "Sugestão para você"}</h2></div>
      <Link className="card link trail" href={`/aprender/${current.id}`}>
        <div className="tile" style={{ background: gradientFor(current.topicSlug) }} aria-hidden>{current.topicName[0]}</div>
        <div style={{ flex: 1 }}><span className="small muted">{current.topicName} · {current.days} dias</span><h3>{current.title}</h3>
          <div className="progress" aria-label={`${current.doneSteps} de ${current.totalSteps} etapas`}><i style={{ width: `${(current.doneSteps / Math.max(1, current.totalSteps)) * 100}%` }} /></div></div></Link></>}
  </div>;
}
