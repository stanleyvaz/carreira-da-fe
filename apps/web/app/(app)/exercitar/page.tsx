import { requireUser } from "@/lib/auth";
import { listActivities, weekOverview } from "@/lib/services/user";
import { InviteCheck, NoteBox } from "@/components/Actions";
export default async function Exercitar() {
  const u = await requireUser(); const [acts, ov] = await Promise.all([listActivities(u.id) as Promise<any[]>, weekOverview(u.id)]);
  return <div className="fade"><p className="eyebrow">Pequenos gestos</p><h1>Exercitar</h1>
    <p className="muted">Exercícios, não obrigações. Escolha o que fizer sentido hoje — ou nenhum.</p>
    <p className="small">Esta semana você fez <strong>{ov.week.activities}</strong> {ov.week.activities === 1 ? "exercício" : "exercícios"}. 🌱</p>
    {acts.length === 0 && <div className="card"><p>Ainda não há exercícios publicados.</p></div>}
    {acts.map((a) => a.lock?.locked ? <div key={a.id} className="card" aria-disabled="true" style={{ opacity: 0.7 }}><div className="invite">
      <span aria-hidden style={{ fontSize: 24, width: 40, textAlign: "center" }}>🔒</span>
      <div style={{ flex: 1 }}><h3 style={{ marginBottom: ".25rem" }}>{a.title}</h3><p className="small" style={{ margin: 0 }}>⏳ {a.lock.reason}</p></div></div></div>
      : <div key={a.id} className="card"><div className="invite">
      <InviteCheck url={`/api/activities/${a.id}/complete`} done={a.done} label={a.title} />
      <div style={{ flex: 1 }}><h3 style={{ marginBottom: ".25rem" }}>{a.title}</h3><p style={{ marginBottom: ".5rem" }}>{a.invitation}</p>
        <details><summary className="small muted">Escrever uma reflexão privada</summary><NoteBox refKind="activity" refId={a.id} /></details></div></div></div>)}
  </div>;
}
