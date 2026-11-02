"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { call } from "@/lib/client";
export default function StepView({ step }: { step: any }) {
  const r = useRouter(); const q = step.questions[0];
  const [sel, setSel] = useState<number | null>(null); const [fb, setFb] = useState<any>(null); const [err, setErr] = useState(""); const [wrong, setWrong] = useState<number[]>([]); const [hint, setHint] = useState("");
  async function finish() {
    try {
      const out = await call("POST", `/api/steps/${step.id}/complete`, { answerIndex: sel });
      if (out.correct === false) { setWrong([...wrong, sel!]); setSel(null); setHint(out.hint ?? "Tente outra resposta."); setErr(""); return; }
      setHint(""); setFb(out); r.refresh();
    } catch (e: any) { setErr(e.message); }
  }
  const locked = !!step.pacing?.locked && !step.done;
  if (locked) return <div className="card" role="status"><h3>Por hoje, é isso 🙂</h3><p>{step.pacing.reason}</p>
    <Link className="btn big" href={`/aprender/${step.journeyId}`}>Voltar à jornada</Link></div>;
  return <div className="card">
    {q && <><h3>Para compreender</h3><p>{q.prompt}</p>
      {q.options.map((o: string, i: number) => <button key={i} className={`opt ${fb ? (i === fb.correctIndex ? "right" : "") : wrong.includes(i) ? "wrong" : ""}`} aria-pressed={sel === i}
        disabled={!!fb || wrong.includes(i)} onClick={() => setSel(i)}>{o}{wrong.includes(i) ? " — tente outra" : ""}</button>)}
      {hint && <p className="small" role="status">{hint}</p>}
      {fb?.explanation && <p className="small" role="status">{fb.explanation}</p>}</>}
    {err && <p role="alert" className="err">{err}</p>}
    {!fb && <button className={step.done ? "btn ghost big" : "btn big"} onClick={finish} disabled={!!q && sel === null}>{wrong.length ? "Tentar de novo" : step.done ? "Refazer" : "Concluir etapa"}</button>}
    {fb && <><p className="okmsg">✓ Etapa concluída. Não há nota — apenas aprendizado.</p>
      {step.nextStepId ? <><p className="small muted">A próxima etapa libera amanhã. Até lá, deixe a Palavra assentar.</p><Link className="btn big" href={`/aprender/${step.journeyId}`}>Voltar à jornada</Link></> : <Link className="btn big" href={`/aprender/${step.journeyId}`}>Ver a jornada</Link>}</>}
    {!fb && step.done && step.nextStepId && <p style={{ marginTop: ".75rem" }}><Link href={`/aprender/${step.journeyId}`}>Voltar à jornada →</Link></p>}
  </div>;
}
