"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { call } from "@/lib/client";
import { IconCheck, IconStar } from "./Icons";

export function CompleteButton({ url, done, label = "Concluir", doneLabel = "Concluído" }: { url: string; done: boolean; label?: string; doneLabel?: string }) {
  const r = useRouter(); const [d, setD] = useState(done); const [err, setErr] = useState("");
  return <>
    <button className={d ? "btn ghost" : "btn"} disabled={d} onClick={async () => { try { await call("POST", url); setD(true); r.refresh(); } catch (e: any) { setErr(e.message); } }}>
      {d ? `✓ ${doneLabel}` : label}</button>
    {err && <p role="alert" className="err small">{err}</p>}</>;
}
export function BookmarkButton({ passageId, initial }: { passageId: string; initial: boolean }) {
  const [b, setB] = useState(initial);
  return <button className="chip" aria-pressed={b} onClick={async () => { const r = await call("POST", "/api/bookmarks", { passageId }); setB(r.bookmarked); }}>
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><IconStar on={b} />{b ? "Favoritado" : "Favoritar"}</span></button>;
}
export function NoteBox({ refKind, refId }: { refKind: "reflection" | "step" | "activity"; refId: string }) {
  const [v, setV] = useState(""); const [msg, setMsg] = useState("");
  return <div className="card"><h3>Anotação privada</h3>
    <p className="small muted">Só você pode ler. É guardada de forma cifrada.</p>
    <label htmlFor={`n-${refId}`} className="muted small">Sua reflexão</label>
    <textarea id={`n-${refId}`} value={v} maxLength={5000} onChange={(e) => setV(e.target.value)} />
    <div className="row" style={{ marginTop: ".5rem" }}>
      <button className="btn ghost" disabled={!v.trim()} onClick={async () => { try { await call("POST", "/api/notes", { body: v, refKind, refId }); setV(""); setMsg("Guardado."); } catch (e: any) { setMsg(e.message); } }}>Guardar</button>
      <span role="status" className="small okmsg">{msg}</span></div></div>;
}
export function Passage({ p, bookmarked }: { p: any; bookmarked: boolean }) {
  return <div>
    {p.text ? <blockquote className="verse">{p.text}</blockquote> : <p className="muted small">Leia a passagem na sua Bíblia.</p>}
    <p className="row"><span className="ref">{p.reference}{p.text ? ` · ${p.translation}` : ""}</span><BookmarkButton passageId={p.id} initial={bookmarked} /></p></div>;
}

/** Exercício estilo "meta pequena": círculo de check gentil, sem cobrança. */
export function InviteCheck({ url, done, label }: { url: string; done: boolean; label: string }) {
  const r = useRouter(); const [d, setD] = useState(done);
  return <button className="check" aria-pressed={d} aria-label={`${label}: ${d ? "feito" : "marcar como feito"}`} disabled={d}
    onClick={async () => { try { await call("POST", url); setD(true); r.refresh(); } catch { /* mantém estado */ } }}><IconCheck /></button>;
}
