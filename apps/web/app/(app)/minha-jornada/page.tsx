import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/services/notifications";
import Profile from "@/components/Profile";
import Reminders from "@/components/Reminders";
import { listBookmarks, listNotes, myJourney } from "@/lib/services/user";
import Account from "@/components/Account";
import { RingLegend, Rings } from "@/components/Rings";
import WeekStrip from "@/components/WeekStrip";
import { IconMedal } from "@/components/Icons";
export default async function Minha() {
  const u = await requireUser();
  const [m, marks, notes]: any = await Promise.all([myJourney(u.id), listBookmarks(u.id), listNotes(u.id)]);
  return <div className="fade"><p className="eyebrow">Só você vê esta página</p><h1>Minha jornada</h1>
    <section className="hero"><Rings week={m.week} goals={m.goals} /><div style={{ flex: 1 }}><p className="eyebrow">Retrospectiva da semana</p><RingLegend week={m.week} goals={m.goals} /></div></section>
    <WeekStrip days={m.days} />
    <div className="stats"><div className="stat"><b>{m.counts.reflections}</b><span>reflexões</span></div><div className="stat"><b>{m.counts.steps}</b><span>etapas</span></div><div className="stat"><b>{m.counts.activities}</b><span>práticas</span></div></div>
    <div className="card"><h3>Marcos</h3><div className="medals">{m.allMilestones.map((x: any) =>
      <div key={x.label} className={`medal ${x.done ? "on" : ""}`}><i><IconMedal /></i><span>{x.label}</span></div>)}</div>
      <p className="small muted" style={{ marginTop: ".75rem" }}>Marcos registram o que você fez, não a sua fé. Não há ranking nem comparação.</p></div>
    {m.topicsStudied.length > 0 && <div className="card"><h3>Temas estudados</h3><div className="chips">{m.topicsStudied.map((t: string) => <span key={t} className="badge">{t}</span>)}</div></div>}
    <div className="card"><h3>Versículos favoritos</h3>{marks.length === 0 ? <p className="muted small">Nenhum ainda.</p> : marks.map((b: any) => <p key={b.passageId}><strong className="ref">{b.reference}</strong>{b.text && <><br /><span style={{ fontFamily: "var(--serif)" }}>{b.text}</span></>}</p>)}</div>
    <div className="card"><h3>Anotações privadas</h3>{notes.length === 0 ? <p className="muted small">Nenhuma ainda.</p> : notes.map((n: any) => <p key={n.id}>{n.body}<br /><span className="small muted">{new Date(n.updatedAt).toLocaleDateString("pt-BR")}</span></p>)}</div>
    <Profile name={u.displayName} email={u.email} hasAvatar={!!u.hasAvatar} />
    <Reminders initial={(await getSettings(u.id)) as any} />
    <Account />
  </div>;
}
