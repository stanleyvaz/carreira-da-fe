"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { call } from "@/lib/client";
import { canTransition, type ContentStatus, type Role } from "@jornada/shared";
import { ACTION_LABEL, ORDER, STATUS_LABEL } from "@/lib/adminLabels";

type Topic = { id: string; name: string };
type Step = { title: string; passage: string; passageText?: string | null; context: string; explanation: string; application: string; extra: string; question: { prompt: string; options: string[]; correctIndex: number; explanation: string } };
const blankStep = (): Step => ({ title: "", passage: "", context: "", explanation: "", application: "", extra: "", question: { prompt: "", options: ["", "", ""], correctIndex: 0, explanation: "" } });

function PassageField({ value, onChange, text }: { value: string; onChange: (v: string) => void; text?: string | null }) {
  const [info, setInfo] = useState<{ ok: boolean; text: string } | null>(text ? { ok: true, text } : null);
  async function check() { try { const r = await call("GET", `/api/admin/bible?ref=${encodeURIComponent(value)}`); onChange(r.reference); setInfo({ ok: true, text: r.text }); } catch (e: any) { setInfo({ ok: false, text: e.message }); } }
  return <div className="field"><label>Passagem bíblica (ACF)</label>
    <div className="row"><input value={value} placeholder="Ex.: Colossenses 3:12-14" onChange={(e) => { onChange(e.target.value); setInfo(null); }} style={{ flex: 1 }} /><button type="button" className="chip" onClick={check}>Verificar</button></div>
    {info && <p className={`small ${info.ok ? "" : "err"}`} style={{ fontFamily: info.ok ? "var(--serif)" : undefined }}>{info.text}</p>}</div>;
}

export default function Editor({ type, id, role, topics }: { type: "journey" | "reflection" | "activity"; id: string; role: Role; topics: Topic[] }) {
  const router = useRouter();
  const [c, setC] = useState<any>(null); const [steps, setSteps] = useState<Step[]>([]); const [msg, setMsg] = useState(""); const [saving, setSaving] = useState(false); const [open, setOpen] = useState(0);
  const load = async () => {
    const r = await call("GET", `/api/admin/content/${type}/${id}`); setC(r);
    if (type === "journey") setSteps((r.steps ?? []).map((s: any) => ({ ...blankStep(), ...s, context: s.context ?? "", explanation: s.explanation ?? "", application: s.application ?? "", extra: s.extra ?? "", passage: s.passage ?? "", passageText: s.passageText,
      question: s.question ? { ...s.question, explanation: s.question.explanation ?? "" } : blankStep().question })));
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((e) => setMsg(e.message)); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!c) return <p className="muted">{msg || "Carregando…"}</p>;
  const draft = c.status === "draft"; const canEdit = (role === "admin" || role === "editor") && draft;
  const set = (k: string, v: any) => setC({ ...c, [k]: v });
  const upd = (i: number, patch: Partial<Step>) => setSteps(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const updQ = (i: number, patch: Partial<Step["question"]>) => upd(i, { question: { ...steps[i].question, ...patch } });

  async function save() {
    setSaving(true); setMsg("");
    try {
      if (type === "journey") {
        await call("PUT", `/api/admin/content/journey/${id}`, { topicId: c.topic_id, title: c.title, summary: c.summary, days: Number(c.days), kind: c.kind, startsAt: c.starts_at?.slice(0, 10) || null, endsAt: c.ends_at?.slice(0, 10) || null });
        await call("PUT", `/api/admin/journeys/${id}/steps`, steps.map((s) => ({ title: s.title, passage: s.passage || null, context: s.context || null, explanation: s.explanation || null, application: s.application || null, extra: s.extra || null,
          question: s.question.prompt ? { prompt: s.question.prompt, options: s.question.options.filter(Boolean), correctIndex: s.question.correctIndex, explanation: s.question.explanation || null } : null })));
      } else if (type === "reflection") {
        await call("PUT", `/api/admin/content/reflection/${id}`, { topicId: c.topic_id, title: c.title, body: c.body, application: c.application, question: c.question, publishDate: c.publish_date?.slice(0, 10) || null, passage: c.passageRef || undefined, passageId: c.passage_id });
      } else await call("PUT", `/api/admin/content/activity/${id}`, { topicId: c.topic_id, title: c.title, invitation: c.invitation });
      setMsg("Salvo."); await load();
    } catch (e: any) { setMsg(e.message); }
    setSaving(false);
  }
  async function go(to: string) {
    const comment = to === "draft" ? window.prompt("Comentário para o autor (opcional)") ?? undefined : undefined;
    try { await call("POST", `/api/admin/content/${type}/${id}/transition`, { to, comment }); await load(); setMsg(`${STATUS_LABEL[to]}.`); } catch (e: any) { setMsg(e.message); }
  }
  const topicSel = <div className="field"><label htmlFor="tp">Tema</label><select id="tp" disabled={!canEdit} value={c.topic_id ?? ""} onChange={(e) => set("topic_id", e.target.value || null)}><option value="">—</option>{topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>;

  return <div>
    <p><Link href={`/admin/lista/${type === "journey" ? (c.kind === "challenge" ? "desafios" : "jornadas") : type === "reflection" ? "reflexoes" : "exercicios"}`}>← Voltar à lista</Link></p>
    <div className="row" style={{ justifyContent: "space-between" }}><h1 style={{ margin: 0 }}>{c.title || "Sem título"}</h1><span className="badge">{STATUS_LABEL[c.status]} · v{c.version}</span></div>
    {!draft && <p className="card" style={{ background: "var(--accent-soft)" }}>Este item está <strong>{STATUS_LABEL[c.status].toLowerCase()}</strong> e não pode ser editado. Para alterar, devolva-o a rascunho (a aprovação anterior é invalidada e uma nova versão é criada).</p>}
    <div className="row" style={{ margin: "1rem 0" }}>{ORDER.filter((to) => canTransition(c.status, to, role)).map((to) => <button key={to} className="chip" onClick={() => go(to)}>{ACTION_LABEL[to]}</button>)}
      <button className="chip" onClick={async () => { const r = await call("POST", `/api/admin/content/${type}/${id}/duplicate`); router.push(`/admin/editar/${type}/${r.id}`); }}>Duplicar como novo rascunho</button></div>
    {msg && <p role="status" className="small">{msg}</p>}

    <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0 }}>
      <div className="card"><div className="grid2">
        <div className="field"><label htmlFor="ti">Título</label><input id="ti" value={c.title ?? ""} onChange={(e) => set("title", e.target.value)} /></div>{topicSel}</div>
        {type === "journey" && <div className="grid2">
          <div className="field"><label htmlFor="su">Resumo</label><input id="su" value={c.summary ?? ""} onChange={(e) => set("summary", e.target.value)} /></div>
          <div className="field"><label htmlFor="dy">Duração (dias) — deve igualar o nº de etapas</label><input id="dy" type="number" min={3} max={40} value={c.days} onChange={(e) => set("days", e.target.value)} /></div>
          <div className="field"><label htmlFor="kd">Tipo</label><select id="kd" value={c.kind} onChange={(e) => set("kind", e.target.value)}><option value="journey">Jornada</option><option value="challenge">Desafio</option></select></div>
          {c.kind === "challenge" && <><div className="field"><label htmlFor="s1">Disponível a partir de</label><input id="s1" type="date" value={c.starts_at?.slice(0, 10) ?? ""} onChange={(e) => set("starts_at", e.target.value)} /></div>
            <div className="field"><label htmlFor="e1">Disponível até</label><input id="e1" type="date" value={c.ends_at?.slice(0, 10) ?? ""} onChange={(e) => set("ends_at", e.target.value)} /></div></>}</div>}
        {type === "reflection" && <>
          <div className="grid2"><div className="field"><label htmlFor="pd">Data de publicação</label><input id="pd" type="date" value={c.publish_date?.slice(0, 10) ?? ""} onChange={(e) => set("publish_date", e.target.value)} /></div></div>
          <PassageField value={c.passageRef ?? ""} onChange={(v) => set("passageRef", v)} text={null} />
          <div className="field"><label htmlFor="bd">Reflexão</label><textarea id="bd" value={c.body ?? ""} onChange={(e) => set("body", e.target.value)} /></div>
          <div className="field"><label htmlFor="ap">Para o seu dia</label><input id="ap" value={c.application ?? ""} onChange={(e) => set("application", e.target.value)} /></div>
          <div className="field"><label htmlFor="qu">Para refletir</label><input id="qu" value={c.question ?? ""} onChange={(e) => set("question", e.target.value)} /></div></>}
        {type === "activity" && <div className="field"><label htmlFor="iv">Exercício (nunca uma ordem)</label><textarea id="iv" value={c.invitation ?? ""} onChange={(e) => set("invitation", e.target.value)} /></div>}
      </div>

      {type === "journey" && <>
        <div className="row" style={{ justifyContent: "space-between" }}><h2>Etapas ({steps.length}/{c.days})</h2>{canEdit && <button type="button" className="chip" onClick={() => { setSteps([...steps, blankStep()]); setOpen(steps.length); }}>+ Adicionar etapa</button>}</div>
        {steps.map((s, i) => <div key={i} className="card"><div className="row" style={{ justifyContent: "space-between" }}>
          <button type="button" className="chip" onClick={() => setOpen(open === i ? -1 : i)}>Dia {i + 1}: {s.title || "(sem título)"} {open === i ? "▾" : "▸"}</button>
          {canEdit && <div className="row"><button type="button" className="chip" disabled={i === 0} onClick={() => { const a = [...steps]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; setSteps(a); setOpen(i - 1); }}>↑</button>
            <button type="button" className="chip" disabled={i === steps.length - 1} onClick={() => { const a = [...steps]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; setSteps(a); setOpen(i + 1); }}>↓</button>
            <button type="button" className="chip" onClick={() => setSteps(steps.filter((_, j) => j !== i))}>Remover</button></div>}</div>
          {open === i && <div style={{ marginTop: "1rem" }}>
            <div className="field"><label>Título da etapa</label><input value={s.title} onChange={(e) => upd(i, { title: e.target.value })} /></div>
            <PassageField value={s.passage} onChange={(v) => upd(i, { passage: v })} text={s.passageText} />
            <div className="field"><label>Contexto</label><textarea value={s.context} onChange={(e) => upd(i, { context: e.target.value })} /></div>
            <div className="field"><label>Explicação</label><textarea value={s.explanation} onChange={(e) => upd(i, { explanation: e.target.value })} /></div>
            <div className="field"><label>Aplicação no cotidiano (exercício)</label><textarea value={s.application} onChange={(e) => upd(i, { application: e.target.value })} /></div>
            <div className="field"><label>Para ir além (opcional; liberado após concluir)</label><textarea value={s.extra} onChange={(e) => upd(i, { extra: e.target.value })} /></div>
            <h3>Pergunta de compreensão</h3>
            <div className="field"><label>Pergunta</label><input value={s.question.prompt} onChange={(e) => updQ(i, { prompt: e.target.value })} /></div>
            {s.question.options.map((o, k) => <div key={k} className="row" style={{ marginBottom: ".5rem" }}>
              <input type="radio" aria-label={`Opção ${k + 1} é a correta`} name={`ok-${i}`} checked={s.question.correctIndex === k} onChange={() => updQ(i, { correctIndex: k })} style={{ width: "auto", minHeight: 0 }} />
              <input value={o} placeholder={`Opção ${k + 1}`} onChange={(e) => updQ(i, { options: s.question.options.map((x, m) => (m === k ? e.target.value : x)) })} style={{ flex: 1 }} />
              {s.question.options.length > 2 && <button type="button" className="chip" onClick={() => updQ(i, { options: s.question.options.filter((_, m) => m !== k), correctIndex: 0 })}>×</button>}</div>)}
            {s.question.options.length < 6 && <button type="button" className="chip" onClick={() => updQ(i, { options: [...s.question.options, ""] })}>+ opção</button>}
            <div className="field" style={{ marginTop: ".75rem" }}><label>Por que esta é a resposta (mostrado após responder)</label><input value={s.question.explanation} onChange={(e) => updQ(i, { explanation: e.target.value })} /></div>
          </div>}</div>)}</>}
    </fieldset>
    {canEdit && <div className="row" style={{ position: "sticky", bottom: 16 }}><button className="btn" disabled={saving} onClick={save}>{saving ? "Salvando…" : "Salvar"}</button></div>}
  </div>;
}
