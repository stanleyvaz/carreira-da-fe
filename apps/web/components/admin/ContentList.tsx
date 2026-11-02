"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { call } from "@/lib/client";
import { canTransition, type ContentStatus, type Role } from "@jornada/shared";
import { ACTION_LABEL, ORDER, SECTIONS, STATUS_LABEL, type SectionKey } from "@/lib/adminLabels";
import SongEditor from "./SongEditor";
import ResourceEditor from "./ResourceEditor";

type Topic = { id: string; name: string; slug: string };
export default function ContentList({ section, role, topics }: { section: SectionKey; role: Role; topics: Topic[] }) {
  const cfg = SECTIONS[section] as { type: "journey" | "reflection" | "activity" | "song" | "resource"; kind?: string; label: string; singular: string };
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]); const [status, setStatus] = useState(""); const [topic, setTopic] = useState(""); const [search, setSearch] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set()); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false); const [creating, setCreating] = useState(false); const [editing, setEditing] = useState<string | null>(null);
  const canEdit = role === "admin" || role === "editor";

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ type: cfg.type, ...(status && { status }), ...(topic && { topic }), ...(search && { q: search }) });
      let r: any[] = await call("GET", `/api/admin/content?${qs}`);
      if (cfg.kind) r = r.filter((x) => x.kind === cfg.kind);
      setRows(r); setSel(new Set());
    } catch (e: any) { setMsg(e.message); }
  }, [cfg.type, cfg.kind, status, topic, search]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const selectedRows = rows.filter((r) => sel.has(r.id));
  const bulkTargets = useMemo(() => {
    if (!selectedRows.length) return [] as ContentStatus[];
    const st = new Set(selectedRows.map((r) => r.status));
    if (st.size !== 1) return [];
    return ORDER.filter((to) => canTransition([...st][0] as ContentStatus, to, role));
  }, [selectedRows, role]);

  async function one(r: any, to: string) {
    const comment = to === "draft" ? window.prompt("Comentário para o autor (opcional)") ?? undefined : undefined;
    try { await call("POST", `/api/admin/content/${cfg.type}/${r.id}/transition`, { to, comment }); setMsg(""); await load(); } catch (e: any) { setMsg(e.message); }
  }
  async function bulk(to: string) {
    if (!window.confirm(`${ACTION_LABEL[to]} ${selectedRows.length} item(ns)?`)) return;
    setBusy(true);
    try {
      const res: any[] = await call("POST", "/api/admin/content/bulk", { type: cfg.type, ids: [...sel], to });
      const bad = res.filter((x) => !x.ok);
      setMsg(`${res.length - bad.length} ok${bad.length ? `, ${bad.length} com erro: ${bad.slice(0, 3).map((b) => b.error).join(" | ")}` : ""}`);
      await load();
    } catch (e: any) { setMsg(e.message); }
    setBusy(false);
  }
  async function dup(r: any) { try { const { id } = await call("POST", `/api/admin/content/${cfg.type}/${r.id}/duplicate`); router.push(`/admin/editar/${cfg.type}/${id}`); } catch (e: any) { setMsg(e.message); } }
  async function del(r: any) { if (!window.confirm(`Excluir o rascunho "${r.title}"?`)) return; try { await call("DELETE", `/api/admin/content/${cfg.type}/${r.id}`); await load(); } catch (e: any) { setMsg(e.message); } }
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); const g = (k: string) => (f.get(k) as string) || undefined;
    const data = cfg.type === "journey" ? { topicId: g("topicId"), title: g("title"), summary: g("summary"), days: Number(g("days")), kind: cfg.kind ?? "journey", startsAt: g("startsAt"), endsAt: g("endsAt") }
      : cfg.type === "reflection" ? { topicId: g("topicId"), title: g("title"), body: g("body") ?? "Escreva a reflexão…", publishDate: g("publishDate") }
      : { topicId: g("topicId"), title: g("title"), invitation: g("invitation") ?? "Que tal…" };
    try { const { id } = await call("POST", "/api/admin/content", { type: cfg.type, data }); router.push(`/admin/editar/${cfg.type}/${id}`); } catch (x: any) { setMsg(x.message); }
  }

  return <div>
    <div className="row" style={{ justifyContent: "space-between" }}><h1>{cfg.label}</h1>
      {canEdit && cfg.type !== "song" && <button className="btn" onClick={() => setCreating(!creating)}>{creating ? "Fechar" : `Novo ${cfg.singular}`}</button>}</div>
    {creating && cfg.type === "resource" && <ResourceEditor topics={topics} onSaved={load} onClose={() => setCreating(false)} />}
    {creating && cfg.type !== "resource" && <form onSubmit={create} className="card"><h3>Novo {cfg.singular}</h3>
      <div className="grid2"><div className="field"><label htmlFor="n-title">Título</label><input id="n-title" name="title" required minLength={3} /></div>
        <div className="field"><label htmlFor="n-topic">Tema</label><select id="n-topic" name="topicId" required={cfg.type === "journey"}><option value="">—</option>{topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div></div>
      {cfg.type === "journey" && <div className="grid2"><div className="field"><label htmlFor="n-days">Duração (dias)</label><input id="n-days" name="days" type="number" min={3} max={40} defaultValue={cfg.kind === "challenge" ? 7 : 5} /></div>
        <div className="field"><label htmlFor="n-sum">Resumo</label><input id="n-sum" name="summary" /></div>
        {cfg.kind === "challenge" && <><div className="field"><label htmlFor="n-s">Início (opcional)</label><input id="n-s" name="startsAt" type="date" /></div><div className="field"><label htmlFor="n-e">Fim (opcional)</label><input id="n-e" name="endsAt" type="date" /></div></>}</div>}
      {cfg.type === "activity" && <div className="field"><label htmlFor="n-inv">Exercício (nunca uma ordem)</label><textarea id="n-inv" name="invitation" required /></div>}
      <button className="btn">Criar rascunho e editar</button></form>}

    <div className="card row">
      <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "auto" }}><option value="">Todos os status</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      {cfg.type !== "song" && cfg.type !== "resource" && <select aria-label="Tema" value={topic} onChange={(e) => setTopic(e.target.value)} style={{ width: "auto" }}><option value="">Todos os temas</option>{topics.map((t) => <option key={t.id} value={t.slug}>{t.name}</option>)}</select>}
      <input aria-label="Buscar" placeholder="Buscar por título" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
    </div>
    {sel.size > 0 && <div className="card row" style={{ background: "var(--accent-soft)" }}><strong>{sel.size} selecionado(s)</strong>
      {bulkTargets.length ? bulkTargets.map((to) => <button key={to} className="btn" disabled={busy} onClick={() => bulk(to)}>{ACTION_LABEL[to]}</button>) : <span className="small muted">Selecione itens com o mesmo status para agir em lote.</span>}</div>}
    {msg && <p role="alert" className="small" style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--accent-soft)", padding: ".5rem .75rem", borderRadius: 10 }}>{msg}</p>}
    <div className="card" style={{ overflowX: "auto", padding: 0 }}><table><thead><tr>
      <th style={{ width: 36 }}><input type="checkbox" aria-label="Selecionar todos" style={{ width: "auto", minHeight: 0 }} checked={rows.length > 0 && sel.size === rows.length} onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} /></th>
      <th>Título</th><th>Status</th><th>Ações</th></tr></thead><tbody>
      {rows.map((r) => <tr key={r.id}>
        <td><input type="checkbox" aria-label={`Selecionar ${r.title}`} style={{ width: "auto", minHeight: 0 }} checked={sel.has(r.id)} onChange={(e) => { const n = new Set(sel); e.target.checked ? n.add(r.id) : n.delete(r.id); setSel(n); }} /></td>
        <td>{cfg.type === "resource" ? <a href={r.url} target="_blank" rel="noopener noreferrer"><strong>{r.title}</strong></a> : <Link href={`/admin/editar/${cfg.type}/${r.id}`}><strong>{r.title}</strong></Link>}
          <div className="small muted">{r.publishDate ? `${new Date(r.publishDate + "T12:00:00").toLocaleDateString("pt-BR")} · ` : ""}{r.topicName ?? ""}{r.audiences?.length ? ` · ${r.audiences.join(", ")}` : ""}{r.days ? ` · ${r.days} dias` : ""} · v{r.version}{r.imported ? " · importado" : ""}{r.featured ? " · ★ em destaque" : ""}{r.starter ? " · 🌱 Primeiros 7 dias" : ""}</div>
          {cfg.type === "resource" && r.status === "draft" && r.missing?.length > 0 && <div className="small" style={{ color: "var(--danger, #e5484d)" }}>Para enviar para revisão, falta: {r.missing.join(", ")}.</div>}
          {cfg.type === "resource" && canEdit && r.status === "draft" && (editing === r.id ? <ResourceEditor id={r.id} topics={topics} onSaved={load} onClose={() => setEditing(null)} /> : <button className="chip" onClick={() => setEditing(r.id)}>Editar indicação</button>)}
          {cfg.type === "song" && canEdit && r.status === "draft" && <SongEditor id={r.id} topics={topics} onSaved={load} />}</td>
        <td><span className="badge">{STATUS_LABEL[r.status]}</span></td>
        <td><div className="row">
          {ORDER.filter((to) => canTransition(r.status, to, role)).map((to) => <button key={to} className="chip" onClick={() => one(r, to)}>{ACTION_LABEL[to]}</button>)}
          {cfg.type === "journey" && r.status === "published" && (role === "admin" || role === "publisher") && cfg.kind === "challenge" && <button className="chip" onClick={async () => { try { await call("POST", `/api/admin/journeys/${r.id}/starter`, { on: !r.starter }); await load(); } catch (e: any) { setMsg(e.message); } }}>{r.starter ? "Remover de “Primeiros 7 dias”" : "Usar como “Primeiros 7 dias”"}</button>}
          {cfg.type === "journey" && r.status === "published" && (role === "admin" || role === "publisher") && !r.featured && <Link className="chip" href={`/admin?promover=${r.id}`}>★ Promover</Link>}
          {canEdit && cfg.type !== "song" && cfg.type !== "resource" && <button className="chip" onClick={() => dup(r)}>Duplicar</button>}
          {canEdit && r.status === "draft" && cfg.type !== "song" && <button className="chip" onClick={() => del(r)}>Excluir</button>}</div></td></tr>)}
      {rows.length === 0 && <tr><td colSpan={4} className="muted" style={{ padding: "1.25rem" }}>Nenhum item.</td></tr>}</tbody></table></div>
  </div>;
}
