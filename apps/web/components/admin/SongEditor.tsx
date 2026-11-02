"use client";
import { useState } from "react";
import { call } from "@/lib/client";
export default function SongEditor({ id, topics, onSaved }: { id: string; topics: { id: string; name: string }[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false); const [credits, setCredits] = useState(""); const [sel, setSel] = useState<string[]>([]); const [msg, setMsg] = useState(""); const [lyrics, setLyrics] = useState("");
  async function openIt() { const s = await call("GET", `/api/admin/songs/${id}`); setCredits(s.credits ?? ""); setLyrics(s.lyrics); setSel(s.topics.map((t: any) => t.id)); setOpen(true); }
  if (!open) return <div><button className="chip" onClick={openIt}>Editar temas e créditos</button></div>;
  return <div className="card" style={{ marginTop: ".5rem" }}>
    <details><summary className="small muted">Ver letra</summary><p style={{ whiteSpace: "pre-line", fontFamily: "var(--serif)" }}>{lyrics}</p></details>
    <label htmlFor={`c-${id}`}>Autoria / créditos</label><input id={`c-${id}`} value={credits} onChange={(e) => setCredits(e.target.value)} />
    <p className="small muted" style={{ margin: ".5rem 0 .25rem" }}>Temas (confirme os sugeridos)</p>
    <div className="chips">{topics.map((t) => <button key={t.id} className="chip" aria-pressed={sel.includes(t.id)} onClick={() => setSel(sel.includes(t.id) ? sel.filter((x) => x !== t.id) : [...sel, t.id])}>{t.name}</button>)}</div>
    <div className="row" style={{ marginTop: ".5rem" }}><button className="btn" onClick={async () => { try { await call("PUT", `/api/admin/songs/${id}`, { credits, topicIds: sel }); setOpen(false); onSaved(); } catch (e: any) { setMsg(e.message); } }}>Salvar</button>
      <button className="chip" onClick={() => setOpen(false)}>Fechar</button><span className="small">{msg}</span></div></div>;
}
