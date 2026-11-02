"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { call } from "@/lib/client";

export default function OnboardingForm({ topics }: { topics: { slug: string; name: string }[] }) {
  const r = useRouter();
  const [sel, setSel] = useState<string[]>([]); const [mode, setMode] = useState("read"); const [min, setMin] = useState(3);
  const [goal, setGoal] = useState(""); const [time, setTime] = useState("08:00"); const [anchor, setAnchor] = useState("Depois do café"); const [remind, setRemind] = useState(true); const [err, setErr] = useState("");
  const ANCHORS: [string, string][] = [["Ao acordar", "06:30"], ["Depois do café", "08:00"], ["Na hora do almoço", "12:30"], ["No fim do dia", "19:30"], ["Antes de dormir", "21:30"]];
  async function save() {
    try { await call("PUT", "/api/me/preferences", { goal: goal || null, topicSlugs: sel, mode, dailyMinutes: min, reminderTime: remind ? time || null : null, anchor: remind ? anchor : null }); r.replace("/"); r.refresh(); }
    catch (x: any) { setErr(x.message); }
  }
  return (
    <div className="fade">
      <p className="muted">Tudo aqui é opcional e pode ser mudado depois.</p>
      <div className="card"><h3>O que gostaria de priorizar?</h3>
        <input aria-label="Objetivo" placeholder="Ex.: ter um momento de calma no dia" value={goal} maxLength={200} onChange={(e) => setGoal(e.target.value)} /></div>
      <div className="card"><h3>Quais assuntos?</h3><div className="chips">
        {topics.map((t) => <button key={t.slug} className="chip" aria-pressed={sel.includes(t.slug)}
          onClick={() => setSel(sel.includes(t.slug) ? sel.filter((s) => s !== t.slug) : [...sel, t.slug])}>{t.name}</button>)}</div></div>
      <div className="card"><h3>Prefere ler ou ouvir?</h3><div className="chips">
        {[["read", "Ler"], ["listen", "Ouvir"]].map(([v, l]) => <button key={v} className="chip" aria-pressed={mode === v} onClick={() => setMode(v)}>{l}</button>)}</div></div>
      <div className="card"><h3>Quanto tempo por dia?</h3><div className="chips">
        {[1, 3, 5, 10].map((m) => <button key={m} className="chip" aria-pressed={min === m} onClick={() => setMin(m)}>{m} min</button>)}</div></div>
      <div className="card"><h3>Quando fica melhor para o seu minuto com a Palavra?</h3>
        <p className="small muted" style={{ marginTop: 0 }}>Hábito novo pega mais fácil quando fica colado a algo que você já faz.</p>
        <div className="chips">{ANCHORS.map(([l, t]) => <button key={l} className="chip" aria-pressed={remind && anchor === l} onClick={() => { setRemind(true); setAnchor(l); setTime(t); }}>{l}</button>)}
          <button className="chip" aria-pressed={!remind} onClick={() => setRemind(false)}>Sem lembrete</button></div>
        {remind && <><label htmlFor="t" className="muted small">Horário do lembrete</label><input id="t" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        <p className="small muted" style={{ marginTop: ".5rem" }}>Um lembrete gentil, no máximo uma vez por dia. Você muda ou desliga quando quiser.</p></>}</div>
      {err && <p role="alert" className="err">{err}</p>}
      <button className="btn" onClick={save} style={{ width: "100%" }}>Começar</button>
    </div>
  );
}
