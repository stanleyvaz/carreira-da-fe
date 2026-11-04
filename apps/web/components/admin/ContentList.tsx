"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { call } from "@/lib/client";
import { canTransition, type ContentStatus, type Role } from "@jornada/shared";
import { ACTION_LABEL, ORDER, SECTIONS, STATUS_LABEL, type SectionKey } from "@/lib/adminLabels";
import SongEditor from "./SongEditor";
import ResourceEditor from "./ResourceEditor";
import PageHead from "./PageHead";
import StatusBadge from "./StatusBadge";
import { useDialog } from "./Dialog";
import { useToast } from "./Toast";

type Topic = { id: string; name: string; slug: string };
type Sort = "status" | "recent" | "title";
const PAGE = 25;
const STATUS_RANK: Record<string, number> = { in_review: 0, draft: 1, approved: 2, published: 3, archived: 4 };
const SORTS: Record<Sort, string> = { status: "Prioridade (em revisão primeiro)", recent: "Atualizados recentemente", title: "Título (A–Z)" };

export default function ContentList({ section, role, topics }: { section: SectionKey; role: Role; topics: Topic[] }) {
  const cfg = SECTIONS[section] as { type: "journey" | "reflection" | "activity" | "song" | "resource"; kind?: string; label: string; singular: string };
  const router = useRouter(); const dialog = useDialog(); const toast = useToast();
  const [rows, setRows] = useState<any[]>([]); const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState(""); const [topic, setTopic] = useState(""); const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("status"); const [page, setPage] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set()); const [busy, setBusy] = useState(false); const [creating, setCreating] = useState(false); const [editing, setEditing] = useState<string | null>(null);
  const canEdit = role === "admin" || role === "editor";

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ type: cfg.type, ...(status && { status }), ...(topic && { topic }), ...(search && { q: search }) });
      let r: any[] = await call("GET", `/api/admin/content?${qs}`);
      if (cfg.kind) r = r.filter((x) => x.kind === cfg.kind);
      setRows(r); setSel(new Set()); setLoaded(true);
    } catch (e: any) { toast(e.message, "error"); }
  }, [cfg.type, cfg.kind, status, topic, search, toast]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const sorted = useMemo(() => {
    const a = [...rows];
    const byRecent = (x: any, y: any) => String(y.updatedAt ?? "").localeCompare(String(x.updatedAt ?? ""));
    if (sort === "title") a.sort((x, y) => String(x.title).localeCompare(String(y.title), "pt-BR"));
    else if (sort === "recent") a.sort(byRecent);
    else a.sort((x, y) => (STATUS_RANK[x.status] ?? 9) - (STATUS_RANK[y.status] ?? 9) || byRecent(x, y));
    return a;
  }, [rows, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE)); const cur = Math.min(page, pages - 1);
  const view = sorted.slice(cur * PAGE, cur * PAGE + PAGE);
  const allOnPage = view.length > 0 && view.every((r) => sel.has(r.id));

  const selectedRows = rows.filter((r) => sel.has(r.id));
  const bulkTargets = useMemo(() => {
    if (!selectedRows.length) return [] as ContentStatus[];
    const st = new Set(selectedRows.map((r) => r.status));
    if (st.size !== 1) return [];
    return ORDER.filter((to) => canTransition([...st][0] as ContentStatus, to, role));
  }, [selectedRows, role]);

  async function one(r: any, to: string) {
    let comment: string | undefined;
    if (to === "draft") {
      const c = await dialog.prompt(`“${r.title}” volta a ser rascunho e precisará de nova aprovação.`, { title: "Devolver a rascunho", label: "Comentário para o autor (opcional)", confirmLabel: "Devolver" });
      if (c === null) return; comment = c || undefined;
    }
    try { await call("POST", `/api/admin/content/${cfg.type}/${r.id}/transition`, { to, comment }); toast(`${r.title}: ${STATUS_LABEL[to].toLowerCase()}.`); await load(); } catch (e: any) { toast(e.message, "error"); }
  }
  async function bulk(to: string) {
    if (!(await dialog.confirm(`${ACTION_LABEL[to]} ${selectedRows.length} item(ns)?`, { title: "Ação em lote", confirmLabel: ACTION_LABEL[to] }))) return;
    setBusy(true);
    try {
      const res: any[] = await call("POST", "/api/admin/content/bulk", { type: cfg.type, ids: [...sel], to });
      const bad = res.filter((x) => !x.ok);
      toast(`${res.length - bad.length} ok${bad.length ? `, ${bad.length} com erro: ${bad.slice(0, 3).map((b) => b.error).join(" | ")}` : ""}`, bad.length ? "error" : "ok");
      await load();
    } catch (e: any) { toast(e.message, "error"); }
    setBusy(false);
  }
  async function dup(r: any) { try { const { id } = await call("POST", `/api/admin/content/${cfg.type}/${r.id}/duplicate`); router.push(`/admin/editar/${cfg.type}/${id}`); } catch (e: any) { toast(e.message, "error"); } }
  async function del(r: any) {
    if (!(await dialog.confirm(`O rascunho “${r.title}” será excluído. Isso não pode ser desfeito.`, { title: "Excluir rascunho", confirmLabel: "Excluir", danger: true }))) return;
    try { await call("DELETE", `/api/admin/content/${cfg.type}/${r.id}`); toast("Rascunho excluído."); await load(); } catch (e: any) { toast(e.message, "error"); }
  }
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); const g = (k: string) => (f.get(k) as string) || undefined;
    const data = cfg.type === "journey" ? { topicId: g("topicId"), title: g("title"), summary: g("summary"), days: Number(g("days")), kind: cfg.kind ?? "journey", startsAt: g("startsAt"), endsAt: g("endsAt") }
      : cfg.type === "reflection" ? { topicId: g("topicId"), title: g("title"), body: g("body") ?? "Escreva a reflexão…", publishDate: g("publishDate") }
      : { topicId: g("topicId"), title: g("title"), invitation: g("invitation") ?? "Que tal…" };
    try { const { id } = await call("POST", "/api/admin/content", { type: cfg.type, data }); router.push(`/admin/editar/${cfg.type}/${id}`); } catch (x: any) { toast(x.message, "error"); }
  }
  const filtered = !!(status || topic || search);
  const resetPage = () => setPage(0);

  return <div>
    <PageHead title={cfg.label} description={!loaded ? "Carregando…" : `${rows.length} ${rows.length === 1 ? "item" : "itens"}${filtered ? " com os filtros atuais" : ""}.`}
      actions={canEdit && cfg.type !== "song" ? <button className="btn" aria-expanded={creating} onClick={() => setCreating(!creating)}>{creating ? "Fechar" : `+ Novo ${cfg.singular}`}</button> : undefined} />
    {creating && cfg.type === "resource" && <ResourceEditor topics={topics} onSaved={load} onClose={() => setCreating(false)} />}
    {creating && cfg.type !== "resource" && <form onSubmit={create} className="card"><h3>Novo {cfg.singular}</h3>
      <div className="grid2"><div className="field"><label htmlFor="n-title">Título</label><input id="n-title" name="title" required minLength={3} /></div>
        <div className="field"><label htmlFor="n-topic">Tema</label><select id="n-topic" name="topicId" required={cfg.type === "journey"}><option value="">—</option>{topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div></div>
      {cfg.type === "journey" && <div className="grid2"><div className="field"><label htmlFor="n-days">Duração (dias)</label><input id="n-days" name="days" type="number" min={3} max={40} defaultValue={cfg.kind === "challenge" ? 7 : 5} /></div>
        <div className="field"><label htmlFor="n-sum">Resumo</label><input id="n-sum" name="summary" /></div>
        {cfg.kind === "challenge" && <><div className="field"><label htmlFor="n-s">Início (opcional)</label><input id="n-s" name="startsAt" type="date" /></div><div className="field"><label htmlFor="n-e">Fim (opcional)</label><input id="n-e" name="endsAt" type="date" /></div></>}</div>}
      {cfg.type === "activity" && <div className="field"><label htmlFor="n-inv">Exercício (nunca uma ordem)</label><textarea id="n-inv" name="invitation" required /></div>}
      <button className="btn">Criar rascunho e editar</button></form>}

    <div className="card toolbar" role="search">
      <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}><option value="">Todos os status</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      {cfg.type !== "song" && cfg.type !== "resource" && <select aria-label="Tema" value={topic} onChange={(e) => { setTopic(e.target.value); resetPage(); }}><option value="">Todos os temas</option>{topics.map((t) => <option key={t.id} value={t.slug}>{t.name}</option>)}</select>}
      <input className="search" type="search" aria-label="Buscar por título" placeholder="Buscar por título" value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }} />
      <select aria-label="Ordenar por" value={sort} onChange={(e) => { setSort(e.target.value as Sort); resetPage(); }}>{Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      {filtered && <button type="button" className="chip" onClick={() => { setStatus(""); setTopic(""); setSearch(""); resetPage(); }}>Limpar filtros</button>}
    </div>
    {sel.size > 0 && <div className="card bulkbar"><strong>{sel.size} selecionado(s)</strong>
      {bulkTargets.length ? bulkTargets.map((to) => <button key={to} className="btn" disabled={busy} onClick={() => bulk(to)}>{ACTION_LABEL[to]}</button>) : <span className="small muted">Selecione itens com o mesmo status para agir em lote.</span>}
      <button type="button" className="chip" onClick={() => setSel(new Set())}>Limpar seleção</button></div>}

    <div className="card tablewrap"><table className="dtable"><thead><tr>
      <th style={{ width: 36 }}><input type="checkbox" aria-label="Selecionar todos desta página" style={{ width: "auto", minHeight: 0 }} checked={allOnPage} onChange={(e) => { const n = new Set(sel); view.forEach((r) => (e.target.checked ? n.add(r.id) : n.delete(r.id))); setSel(n); }} /></th>
      <th scope="col">Título</th><th scope="col">Status</th><th scope="col">Ações</th></tr></thead><tbody>
      {view.map((r) => <tr key={r.id}>
        <td><input type="checkbox" aria-label={`Selecionar ${r.title}`} style={{ width: "auto", minHeight: 0 }} checked={sel.has(r.id)} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(r.id); else n.delete(r.id); setSel(n); }} /></td>
        <td className="title">{cfg.type === "resource" ? <a href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a> : <Link href={`/admin/editar/${cfg.type}/${r.id}`}>{r.title}</Link>}
          <div className="rowmeta">{r.publishDate ? `${new Date(r.publishDate + "T12:00:00").toLocaleDateString("pt-BR")} · ` : ""}{r.topicName ?? ""}{r.audiences?.length ? ` · ${r.audiences.join(", ")}` : ""}{r.days ? ` · ${r.days} dias` : ""} · v{r.version}{r.updatedAt ? ` · atualizado em ${new Date(r.updatedAt).toLocaleDateString("pt-BR")}` : ""}{r.imported ? " · importado" : ""}{r.featured ? " · ★ em destaque" : ""}{r.starter ? " · 🌱 Primeiros 7 dias" : ""}</div>
          {cfg.type === "resource" && r.status === "draft" && r.missing?.length > 0 && <div className="missing">Para enviar para revisão, falta: {r.missing.join(", ")}.</div>}
          {cfg.type === "resource" && canEdit && r.status === "draft" && (editing === r.id ? <ResourceEditor id={r.id} topics={topics} onSaved={load} onClose={() => setEditing(null)} /> : <button className="chip" style={{ marginTop: ".4rem" }} onClick={() => setEditing(r.id)}>Editar indicação</button>)}
          {cfg.type === "song" && canEdit && r.status === "draft" && <SongEditor id={r.id} topics={topics} onSaved={load} />}</td>
        <td><StatusBadge status={r.status} /></td>
        <td><div className="rowactions">
          {ORDER.filter((to) => canTransition(r.status, to, role)).map((to) => <button key={to} className="chip" onClick={() => one(r, to)}>{ACTION_LABEL[to]}</button>)}
          {cfg.type === "journey" && r.status === "published" && (role === "admin" || role === "publisher") && cfg.kind === "challenge" && <button className="chip" onClick={async () => { try { await call("POST", `/api/admin/journeys/${r.id}/starter`, { on: !r.starter }); await load(); } catch (e: any) { toast(e.message, "error"); } }}>{r.starter ? "Remover de “Primeiros 7 dias”" : "Usar como “Primeiros 7 dias”"}</button>}
          {cfg.type === "journey" && r.status === "published" && (role === "admin" || role === "publisher") && !r.featured && <Link className="chip" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }} href={`/admin?promover=${r.id}`}>★ Promover</Link>}
          {canEdit && cfg.type !== "song" && cfg.type !== "resource" && <button className="chip" onClick={() => dup(r)}>Duplicar</button>}
          {canEdit && r.status === "draft" && cfg.type !== "song" && <button className="chip danger" onClick={() => del(r)}>Excluir</button>}</div></td></tr>)}
      {loaded && rows.length === 0 && <tr><td colSpan={4}><div className="emptystate"><h3>{filtered ? "Nenhum item encontrado" : `Ainda não há ${cfg.label.toLowerCase()}`}</h3>
        <p>{filtered ? "Ajuste ou limpe os filtros para ver mais resultados." : canEdit && cfg.type !== "song" ? `Crie o primeiro com “Novo ${cfg.singular}”.` : "Quando houver itens, eles aparecem aqui."}</p></div></td></tr>}
      {!loaded && <tr><td colSpan={4} className="muted" style={{ padding: "1.25rem" }}>Carregando…</td></tr>}</tbody></table>
      {sorted.length > PAGE && <nav className="pager" aria-label="Paginação"><span>{cur * PAGE + 1}–{Math.min(sorted.length, (cur + 1) * PAGE)} de {sorted.length}</span>
        <span className="row"><button className="chip" disabled={cur === 0} onClick={() => setPage(cur - 1)}>← Anterior</button><span aria-live="polite">Página {cur + 1} de {pages}</span><button className="chip" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Próxima →</button></span></nav>}
    </div>
  </div>;
}
