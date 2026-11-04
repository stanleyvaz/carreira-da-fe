"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { call } from "@/lib/client";
import { canTransition, type Role } from "@jornada/shared";
import { ACTION_LABEL, ORDER, STATUS_LABEL } from "@/lib/adminLabels";
import PageHead from "./PageHead";
import StatusBadge from "./StatusBadge";
import { useDialog } from "./Dialog";
import { useToast } from "./Toast";

type Topic = { id: string; name: string };
type Question = { prompt: string; options: string[]; correctIndex: number; explanation: string };
type Step = { uid: string; title: string; passage: string; passageText?: string | null; context: string; explanation: string; application: string; extra: string; question: Question };
let uidSeq = 0;
const blankStep = (): Step => ({ uid: `s${++uidSeq}`, title: "", passage: "", context: "", explanation: "", application: "", extra: "", question: { prompt: "", options: ["", "", ""], correctIndex: 0, explanation: "" } });
const MAX_STEPS = 14;
const fmt = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

/** Erros bloqueiam o salvamento (o servidor rejeitaria); avisos são pendências para enviar à revisão. */
function validate(type: string, c: any, steps: Step[]) {
  const errors: string[] = []; const warnings: string[] = [];
  if ((c.title ?? "").trim().length < 3) errors.push("O título precisa de ao menos 3 caracteres.");
  if (type === "journey") {
    steps.forEach((s, i) => {
      const d = `Dia ${i + 1}`;
      if (s.title.trim().length < 2) errors.push(`${d}: informe o título da etapa.`);
      if (s.question.prompt.trim()) {
        if (s.question.options.filter((o) => o.trim()).length < 2) errors.push(`${d}: a pergunta precisa de ao menos 2 opções preenchidas.`);
        else if (!s.question.options[s.question.correctIndex]?.trim()) errors.push(`${d}: marque como correta uma opção preenchida.`);
      } else if (s.question.options.some((o) => o.trim())) warnings.push(`${d}: há opções sem o enunciado da pergunta — a pergunta não será salva.`);
    });
    if (steps.length > MAX_STEPS) errors.push(`No máximo ${MAX_STEPS} etapas.`);
    if (steps.length !== Number(c.days)) warnings.push(`A duração é de ${c.days} dias, mas há ${steps.length} etapa(s). Iguale os dois antes de enviar para revisão.`);
  }
  return { errors, warnings };
}

function Counter({ n, max }: { n: number; max: number }) { return <span className={`counter${n > max * 0.9 ? " near" : ""}`} aria-hidden="true">{n}/{max}</span>; }
function Txt({ id, label, value, onChange, max, rows = 4, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; max: number; rows?: number; hint?: string }) {
  return <div className="field"><label htmlFor={id}>{label}<Counter n={value.length} max={max} /></label>
    <textarea id={id} rows={rows} maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} />{hint && <p className="hint">{hint}</p>}</div>;
}

function PassageField({ id, value, onChange, text }: { id: string; value: string; onChange: (v: string) => void; text?: string | null }) {
  const [info, setInfo] = useState<{ ok: boolean; text: string } | null>(text ? { ok: true, text } : null);
  async function check() { try { const r = await call("GET", `/api/admin/bible?ref=${encodeURIComponent(value)}`); onChange(r.reference); setInfo({ ok: true, text: r.text }); } catch (e: any) { setInfo({ ok: false, text: e.message }); } }
  return <div className="field"><label htmlFor={id}>Passagem bíblica (ACF)</label>
    <div className="row"><input id={id} value={value} placeholder="Ex.: Colossenses 3:12-14" onChange={(e) => { onChange(e.target.value); setInfo(null); }} style={{ flex: 1 }} /><button type="button" className="chip" onClick={check}>Verificar</button></div>
    {info && <p className={`small ${info.ok ? "" : "err"}`} role="status" style={{ fontFamily: info.ok ? "var(--serif)" : undefined }}>{info.text}</p>}</div>;
}

export default function Editor({ type, id, role, topics }: { type: "journey" | "reflection" | "activity"; id: string; role: Role; topics: Topic[] }) {
  const router = useRouter(); const toast = useToast(); const dialog = useDialog();
  const [c, setC] = useState<any>(null); const [steps, setSteps] = useState<Step[]>([]); const [saving, setSaving] = useState(false); const [open, setOpen] = useState(0);
  const [dirty, setDirty] = useState(false); const [loadErr, setLoadErr] = useState("");

  const load = useCallback(async () => {
    const r = await call("GET", `/api/admin/content/${type}/${id}`); setC(r);
    if (type === "journey") setSteps((r.steps ?? []).map((s: any) => ({ ...blankStep(), ...s, context: s.context ?? "", explanation: s.explanation ?? "", application: s.application ?? "", extra: s.extra ?? "", passage: s.passage ?? "", passageText: s.passageText,
      question: s.question ? { ...s.question, explanation: s.question.explanation ?? "" } : blankStep().question })));
    setDirty(false);
  }, [type, id]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((e) => setLoadErr(e.message)); }, [load]);

  const mayEdit = (role === "admin" || role === "editor") && c?.status === "draft";
  const save = useCallback(async () => {
    if (!c || saving || !mayEdit) return;
    const { errors } = validate(type, c, steps);
    if (errors.length) { toast(errors[0], "error"); return; }
    setSaving(true);
    try {
      if (type === "journey") {
        // Um único PUT: metadados + etapas na mesma transação no servidor (tudo ou nada).
        const payload = steps.map((s) => {
          const opts = s.question.options.map((o, k) => ({ o: o.trim(), k })).filter((x) => x.o); // índice da correta é remapeado após remover vazias
          return { title: s.title, passage: s.passage || null, context: s.context || null, explanation: s.explanation || null, application: s.application || null, extra: s.extra || null,
            question: s.question.prompt.trim() ? { prompt: s.question.prompt, options: opts.map((x) => x.o), correctIndex: opts.findIndex((x) => x.k === s.question.correctIndex), explanation: s.question.explanation || null } : null };
        });
        await call("PUT", `/api/admin/content/journey/${id}`, { topicId: c.topic_id, title: c.title, summary: c.summary, days: Number(c.days), kind: c.kind, startsAt: c.starts_at?.slice(0, 10) || null, endsAt: c.ends_at?.slice(0, 10) || null, steps: payload });
      } else if (type === "reflection") {
        await call("PUT", `/api/admin/content/reflection/${id}`, { topicId: c.topic_id, title: c.title, body: c.body, application: c.application, question: c.question, publishDate: c.publish_date?.slice(0, 10) || null, passage: c.passageRef || undefined, passageId: c.passage_id });
      } else await call("PUT", `/api/admin/content/activity/${id}`, { topicId: c.topic_id, title: c.title, invitation: c.invitation });
      await load(); toast("Salvo.");
    } catch (e: any) { toast(e.message, "error"); }
    setSaving(false);
  }, [c, steps, saving, mayEdit, type, id, load, toast]);

  // Aviso ao fechar/recarregar com alterações pendentes; Ctrl/Cmd+S salva.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (dirty) void save(); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [dirty, save]);

  if (!c) return <p className={loadErr ? "err" : "muted"} role={loadErr ? "alert" : "status"}>{loadErr || "Carregando…"}</p>;
  const draft = c.status === "draft"; const canEdit = mayEdit;
  const set = (k: string, v: any) => { setC({ ...c, [k]: v }); setDirty(true); };
  const upd = (i: number, patch: Partial<Step>) => { setSteps(steps.map((s, j) => (j === i ? { ...s, ...patch } : s))); setDirty(true); };
  const updQ = (i: number, patch: Partial<Question>) => upd(i, { question: { ...steps[i].question, ...patch } });
  const { errors, warnings } = validate(type, c, steps);
  const back = `/admin/lista/${type === "journey" ? (c.kind === "challenge" ? "desafios" : "jornadas") : type === "reflection" ? "reflexoes" : "exercicios"}`;
  const hasContent = (s: Step) => !!(s.title || s.context || s.explanation || s.application || s.extra || s.question.prompt);

  async function leave(href: string) {
    if (dirty && !(await dialog.confirm("Há alterações não salvas. Se sair agora, elas serão perdidas.", { title: "Alterações não salvas", confirmLabel: "Descartar e sair", danger: true }))) return;
    router.push(href);
  }
  async function go(to: string) {
    if (dirty) { toast("Salve as alterações antes de mudar o status.", "error"); return; }
    let comment: string | undefined;
    if (to === "draft") {
      const v = await dialog.prompt("A aprovação anterior será invalidada e uma nova versão será criada.", { title: "Devolver a rascunho", label: "Comentário para o autor (opcional)", confirmLabel: "Devolver" });
      if (v === null) return; comment = v || undefined;
    }
    try { await call("POST", `/api/admin/content/${type}/${id}/transition`, { to, comment }); await load(); toast(`${STATUS_LABEL[to]}.`); } catch (e: any) { toast(e.message, "error"); }
  }
  async function duplicate() {
    try { const r = await call("POST", `/api/admin/content/${type}/${id}/duplicate`); await leave(`/admin/editar/${type}/${r.id}`); } catch (e: any) { toast(e.message, "error"); }
  }
  async function removeStep(i: number) {
    if (hasContent(steps[i]) && !(await dialog.confirm(`Remover a etapa do dia ${i + 1}? O conteúdo dela será perdido ao salvar.`, { title: "Remover etapa", confirmLabel: "Remover", danger: true }))) return;
    setSteps(steps.filter((_, j) => j !== i)); setOpen(Math.max(0, Math.min(i, steps.length - 2))); setDirty(true);
  }
  const move = (i: number, d: -1 | 1) => { const a = [...steps]; [a[i + d], a[i]] = [a[i], a[i + d]]; setSteps(a); setOpen(i + d); setDirty(true); };

  const topicSel = <div className="field"><label htmlFor="tp">Tema</label><select id="tp" disabled={!canEdit} value={c.topic_id ?? ""} onChange={(e) => set("topic_id", e.target.value || null)}><option value="">—</option>{topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>;
  const flat: React.CSSProperties = { border: 0, padding: 0, margin: 0, minWidth: 0 };

  return <div>
    <PageHead title={<>{c.title || "Sem título"}<StatusBadge status={c.status} /></>}
      description={type === "journey" ? (c.kind === "challenge" ? "Desafio" : "Jornada") : type === "reflection" ? "Reflexão diária" : "Exercício"}>
      <button type="button" className="crumb" onClick={() => leave(back)}>← Voltar à lista</button>
    </PageHead>
    <div className="editgrid">
      <div>
        {!draft && <p className="notice">Este item está <strong>{STATUS_LABEL[c.status].toLowerCase()}</strong> e não pode ser editado. Para alterar, devolva-o a rascunho (a aprovação anterior é invalidada e uma nova versão é criada).</p>}
        <fieldset disabled={!canEdit} style={flat}>
          <div className="card"><div className="grid2">
            <div className="field"><label htmlFor="ti">Título<Counter n={(c.title ?? "").length} max={140} /></label><input id="ti" maxLength={140} value={c.title ?? ""} onChange={(e) => set("title", e.target.value)} /></div>{topicSel}</div>
            {type === "journey" && <div className="grid2">
              <div className="field"><label htmlFor="su">Resumo</label><input id="su" value={c.summary ?? ""} onChange={(e) => set("summary", e.target.value)} /></div>
              <div className="field"><label htmlFor="dy">Duração (dias)</label><input id="dy" type="number" min={3} max={40} value={c.days} onChange={(e) => set("days", e.target.value)} /><p className="hint">Deve igualar o número de etapas.</p></div>
              <div className="field"><label htmlFor="kd">Tipo</label><select id="kd" value={c.kind} onChange={(e) => set("kind", e.target.value)}><option value="journey">Jornada</option><option value="challenge">Desafio</option></select></div>
              {c.kind === "challenge" && <><div className="field"><label htmlFor="s1">Disponível a partir de</label><input id="s1" type="date" value={c.starts_at?.slice(0, 10) ?? ""} onChange={(e) => set("starts_at", e.target.value)} /></div>
                <div className="field"><label htmlFor="e1">Disponível até</label><input id="e1" type="date" value={c.ends_at?.slice(0, 10) ?? ""} onChange={(e) => set("ends_at", e.target.value)} /></div></>}</div>}
            {type === "reflection" && <>
              <div className="grid2"><div className="field"><label htmlFor="pd">Data de publicação</label><input id="pd" type="date" value={c.publish_date?.slice(0, 10) ?? ""} onChange={(e) => set("publish_date", e.target.value)} /></div></div>
              <PassageField id="rp" value={c.passageRef ?? ""} onChange={(v) => set("passageRef", v)} text={null} />
              <div className="field"><label htmlFor="bd">Reflexão</label><textarea id="bd" rows={10} value={c.body ?? ""} onChange={(e) => set("body", e.target.value)} /></div>
              <div className="field"><label htmlFor="ap">Para o seu dia</label><input id="ap" value={c.application ?? ""} onChange={(e) => set("application", e.target.value)} /></div>
              <div className="field"><label htmlFor="qu">Para refletir</label><input id="qu" value={c.question ?? ""} onChange={(e) => set("question", e.target.value)} /></div></>}
            {type === "activity" && <Txt id="iv" label="Exercício (nunca uma ordem)" value={c.invitation ?? ""} max={600} onChange={(v) => set("invitation", v)} />}
          </div>
        </fieldset>

        {type === "journey" && <>
          <div className="stepsbar"><h2>Etapas ({steps.length}/{c.days})</h2>
            <div className="row"><div className="progressmini" role="img" aria-label={`${steps.length} de ${c.days} etapas`}><i style={{ width: `${Math.min(100, (steps.length / Math.max(1, Number(c.days))) * 100)}%` }} /></div>
              {canEdit && <button type="button" className="chip" disabled={steps.length >= MAX_STEPS} onClick={() => { setSteps([...steps, blankStep()]); setOpen(steps.length); setDirty(true); }}>+ Adicionar etapa</button>}</div></div>
          {steps.length === 0 && <div className="card emptystate"><h3>Nenhuma etapa ainda</h3><p>Cada etapa é um dia da jornada: passagem, explicação, aplicação e uma pergunta.</p></div>}
          {steps.map((s, i) => {
            const bad = errors.some((e) => e.startsWith(`Dia ${i + 1}:`)); const isOpen = open === i;
            return <div key={s.uid} className="card">
              <div className="stephead">
                <button type="button" className="stepbtn" id={`sh-${i}`} aria-expanded={isOpen} aria-controls={`sb-${i}`} onClick={() => setOpen(isOpen ? -1 : i)}>
                  <span className="n" aria-hidden="true">{i + 1}</span><span className="t"><span className="sr-only">Dia {i + 1}: </span>{s.title || <em>(sem título)</em>}</span>
                  {bad && <span className="flag">Revisar</span>}<span className="chev" aria-hidden="true">{isOpen ? "▾" : "▸"}</span></button>
                {canEdit && <div className="row" style={{ gap: ".35rem", flexWrap: "nowrap" }}>
                  <button type="button" className="chip" aria-label={`Mover etapa ${i + 1} para cima`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                  <button type="button" className="chip" aria-label={`Mover etapa ${i + 1} para baixo`} disabled={i === steps.length - 1} onClick={() => move(i, 1)}>↓</button>
                  <button type="button" className="chip danger" onClick={() => removeStep(i)}>Remover</button></div>}</div>
              {isOpen && <div className="stepbody" id={`sb-${i}`} role="region" aria-labelledby={`sh-${i}`}>
                <fieldset disabled={!canEdit} style={flat}>
                  <div className="field"><label htmlFor={`st-${i}`}>Título da etapa<Counter n={s.title.length} max={140} /></label><input id={`st-${i}`} maxLength={140} value={s.title} onChange={(e) => upd(i, { title: e.target.value })} /></div>
                  <PassageField id={`sp-${i}`} value={s.passage} onChange={(v) => upd(i, { passage: v })} text={s.passageText} />
                  <Txt id={`sc-${i}`} label="Contexto" value={s.context} max={3000} onChange={(v) => upd(i, { context: v })} />
                  <Txt id={`se-${i}`} label="Explicação" value={s.explanation} max={5000} rows={6} onChange={(v) => upd(i, { explanation: v })} />
                  <Txt id={`sa-${i}`} label="Aplicação no cotidiano (exercício)" value={s.application} max={2000} onChange={(v) => upd(i, { application: v })} />
                  <Txt id={`sx-${i}`} label="Para ir além (opcional)" hint="Liberado para quem conclui a etapa." value={s.extra} max={5000} onChange={(v) => upd(i, { extra: v })} />
                  <h3>Pergunta de compreensão</h3>
                  <div className="field"><label htmlFor={`sq-${i}`}>Pergunta<Counter n={s.question.prompt.length} max={300} /></label><input id={`sq-${i}`} maxLength={300} value={s.question.prompt} onChange={(e) => updQ(i, { prompt: e.target.value })} /></div>
                  <fieldset style={flat}><legend className="small muted" style={{ marginBottom: ".4rem" }}>Opções — marque a resposta correta</legend>
                    {s.question.options.map((o, k) => <div key={k} className="optrow">
                      <input type="radio" aria-label={`Opção ${k + 1} é a correta`} name={`ok-${s.uid}`} checked={s.question.correctIndex === k} onChange={() => updQ(i, { correctIndex: k })} />
                      <input aria-label={`Texto da opção ${k + 1}`} value={o} maxLength={200} placeholder={`Opção ${k + 1}`} onChange={(e) => updQ(i, { options: s.question.options.map((x, m) => (m === k ? e.target.value : x)) })} style={{ flex: 1 }} />
                      {s.question.options.length > 2 && <button type="button" className="chip" aria-label={`Remover opção ${k + 1}`} onClick={() => updQ(i, { options: s.question.options.filter((_, m) => m !== k), correctIndex: s.question.correctIndex === k ? 0 : s.question.correctIndex > k ? s.question.correctIndex - 1 : s.question.correctIndex })}>×</button>}</div>)}
                    {s.question.options.length < 6 && <button type="button" className="chip" onClick={() => updQ(i, { options: [...s.question.options, ""] })}>+ opção</button>}</fieldset>
                  <div className="field" style={{ marginTop: ".75rem" }}><label htmlFor={`sw-${i}`}>Por que esta é a resposta<Counter n={s.question.explanation.length} max={1000} /></label><input id={`sw-${i}`} maxLength={1000} value={s.question.explanation} onChange={(e) => updQ(i, { explanation: e.target.value })} /><p className="hint">Mostrado após responder.</p></div>
                </fieldset>
              </div>}</div>;
          })}</>}
      </div>

      <aside className="editside" aria-label="Status e ações">
        <div className="card">
          <div className="sidehead"><StatusBadge status={c.status} /><span className="small muted">versão {c.version}</span></div>
          <div className="sideactions">
            {canEdit && <><button type="button" className="btn" disabled={saving || !dirty} onClick={() => void save()}>{saving ? "Salvando…" : "Salvar"}</button>
              <p className="hint" style={{ margin: 0, textAlign: "center" }}>{dirty ? <span className="dirty" role="status">Alterações não salvas</span> : <span className="clean" role="status">Tudo salvo · Ctrl/⌘ + S</span>}</p></>}
            {ORDER.filter((to) => canTransition(c.status, to, role)).map((to) => <button key={to} type="button" className="chip" disabled={saving} onClick={() => go(to)}>{ACTION_LABEL[to]}</button>)}
            <button type="button" className="chip" onClick={duplicate}>Duplicar como novo rascunho</button>
          </div>
        </div>
        {draft && <div className="card"><h3 style={{ fontSize: ".95rem" }}>Verificações</h3>
          <ul className="checks">
            {errors.map((e) => <li key={e} data-k="error">{e}</li>)}{warnings.map((w) => <li key={w} data-k="warn">{w}</li>)}
            {!errors.length && !warnings.length && <li data-k="ok">Nada a corrigir. Pronto para enviar para revisão.</li>}</ul></div>}
        <div className="card"><h3 style={{ fontSize: ".95rem" }}>Detalhes</h3>
          <dl className="sidemeta"><dt>Atualizado</dt><dd>{fmt(c.updated_at)}</dd><dt>Criado</dt><dd>{fmt(c.created_at)}</dd>
            {c.published_at && <><dt>Publicado</dt><dd>{fmt(c.published_at)}</dd></>}
            {type === "journey" && <><dt>Etapas</dt><dd>{steps.length} / {c.days}</dd></>}</dl>
          <p className="small" style={{ margin: ".75rem 0 0" }}><Link href={back} onClick={(e) => { if (dirty) { e.preventDefault(); void leave(back); } }}>← Voltar à lista</Link></p></div>
      </aside>
    </div>
  </div>;
}
