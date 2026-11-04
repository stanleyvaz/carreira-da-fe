"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { call } from "@/lib/client";
import type { Role } from "@jornada/shared";
import PageHead from "./PageHead";
import { useDialog } from "./Dialog";
import { useToast } from "./Toast";

const patch = (rows: any[], i: number, p: object) => rows.map((x, j) => (j === i ? { ...x, ...p } : x));

export function TopicsPanel({ role }: { role: Role }) {
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]); const [name, setName] = useState(""); const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState<Set<string>>(new Set()); const [search, setSearch] = useState("");
  const load = useCallback(async () => { try { setRows(await call("GET", "/api/admin/topics")); setDirty(new Set()); } catch (e: any) { toast(e.message, "error"); } setLoaded(true); }, [toast]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  const can = role === "admin" || role === "editor";
  const edit = (i: number, p: object) => { setRows(patch(rows, i, p)); setDirty(new Set(dirty).add(rows[i].id)); };
  async function save(r: any) {
    try { await call("POST", "/api/admin/topics", { id: r.id, name: r.name, description: r.description, sortOrder: Number(r.sortOrder) }); toast(`Tema “${r.name}” salvo.`); await load(); } catch (e: any) { toast(e.message, "error"); }
  }
  async function add() { try { await call("POST", "/api/admin/topics", { name }); setName(""); toast("Tema adicionado."); await load(); } catch (e: any) { toast(e.message, "error"); } }
  const shown = useMemo(() => rows.map((r, i) => ({ r, i })).filter(({ r }) => !search || r.name.toLowerCase().includes(search.toLowerCase())), [rows, search]);
  return <div>
    <PageHead title="Temas" description="Organizam jornadas, reflexões, músicas e a biblioteca. A ordem define como aparecem no app." />
    {can && <form className="card row" onSubmit={(e) => { e.preventDefault(); if (name.trim().length >= 2) void add(); }}>
      <input aria-label="Novo tema" placeholder="Nome do novo tema" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
      <button className="btn" disabled={name.trim().length < 2}>Adicionar tema</button></form>}
    {rows.length > 6 && <div className="card toolbar"><input className="search" aria-label="Buscar tema" placeholder="Buscar tema" value={search} onChange={(e) => setSearch(e.target.value)} /></div>}
    {loaded && shown.length === 0 && <p className="card muted">{search ? "Nenhum tema encontrado." : "Nenhum tema ainda."}</p>}
    {shown.map(({ r, i }) => <div key={r.id} className="card"><div className="grid2">
      <div className="field"><label htmlFor={`tn-${r.id}`}>Nome</label><input id={`tn-${r.id}`} disabled={!can} value={r.name} onChange={(e) => edit(i, { name: e.target.value })} /></div>
      <div className="field"><label htmlFor={`to-${r.id}`}>Ordem</label><input id={`to-${r.id}`} type="number" disabled={!can} value={r.sortOrder} onChange={(e) => edit(i, { sortOrder: e.target.value })} /></div></div>
      <div className="field"><label htmlFor={`td-${r.id}`}>Descrição</label><input id={`td-${r.id}`} disabled={!can} value={r.description ?? ""} onChange={(e) => edit(i, { description: e.target.value })} /></div>
      {can && <div className="row"><button className="btn" disabled={!dirty.has(r.id)} onClick={() => save(r)}>Salvar</button>{dirty.has(r.id) && <span className="small muted">Alterações não salvas</span>}</div>}</div>)}
  </div>;
}

const ROLE_LABEL: Record<string, string> = { admin: "Administrador", editor: "Editor", reviewer: "Revisor de conteúdo", publisher: "Publicador", analyst: "Analista (indicadores)", user: "Usuário comum (remove acesso)" };
const ROLE_HELP: Record<string, string> = {
  admin: "Tudo, incluindo gerenciar a equipe.", editor: "Cria e edita rascunhos.", reviewer: "Revisa e aprova conteúdo de outras pessoas.",
  publisher: "Publica conteúdo aprovado, promove destaques e envia notificações.", analyst: "Vê somente indicadores agregados.", user: "Remove o acesso ao console.",
};
export function StaffPanel({ role }: { role: Role }) {
  const toast = useToast(); const dialog = useDialog();
  const [rows, setRows] = useState<any[]>([]); const [email, setEmail] = useState(""); const [r, setR] = useState("editor"); const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => { try { setRows(await call("GET", "/api/admin/users")); } catch (e: any) { toast(e.message, "error"); } setLoaded(true); }, [toast]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (role === "admin") void load(); }, [load, role]);
  async function setRole(em: string, ro: string) { try { await call("PUT", "/api/admin/users", { email: em, role: ro }); toast("Perfil atualizado."); setEmail(""); await load(); } catch (e: any) { toast(e.message, "error"); } }
  if (role !== "admin") return <div><PageHead title="Equipe" /><p className="card muted">Somente administradores gerenciam a equipe.</p></div>;
  return <div>
    <PageHead title="Equipe e perfis" description="Quem pode criar, revisar, publicar e ver indicadores. A pessoa precisa ter criado a conta no app. Nenhum perfil vê dados individuais de uso." />
    <form className="card" onSubmit={(e) => { e.preventDefault(); if (email) void setRole(email, r); }}><h3>Conceder ou alterar perfil</h3>
      <div className="grid2"><div className="field"><label htmlFor="em">E-mail da conta</label><input id="em" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label htmlFor="ro">Perfil</label><select id="ro" value={r} onChange={(e) => setR(e.target.value)} aria-describedby="ro-help">{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <p id="ro-help" className="small muted">{ROLE_HELP[r]}</p></div></div>
      <button className="btn" disabled={!email}>Aplicar</button></form>
    <div className="card" style={{ overflowX: "auto", padding: 0 }}><table><thead><tr><th>Conta</th><th>Perfil</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>
      {rows.map((u) => <tr key={u.id}><td>{u.email}</td><td>{ROLE_LABEL[u.role]}</td><td><button className="chip" onClick={async () => {
        if (await dialog.confirm(`${u.email} perde o acesso ao console editorial. A conta no app continua existindo.`, { title: "Remover acesso", confirmLabel: "Remover acesso", danger: true })) void setRole(u.email, "user");
      }}>Remover acesso</button></td></tr>)}
      {loaded && rows.length === 0 && <tr><td colSpan={3} className="muted" style={{ padding: "1.25rem" }}>Nenhuma pessoa com acesso editorial.</td></tr>}</tbody></table></div>
  </div>;
}

export function MetricsPanel() {
  const toast = useToast();
  const [m, setM] = useState<any>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { call("GET", "/api/admin/metrics").then(setM).catch((e) => toast(e.message, "error")); }, [toast]);
  const kpi = (label: string, v: any) => <div className="stat"><b>{v ?? "—"}</b><span>{label}</span></div>;
  return <div>
    <PageHead title="Indicadores agregados" description="Grupos com menos de 5 pessoas aparecem como “—” para evitar identificação. Não há dados individuais." />
    {!m && <p className="muted">Carregando…</p>}
    {m && <>
      <div className="stats">{kpi("Usuários ativos (30 dias)", m.activeUsers30d)}{kpi("Etapas concluídas", m.stepsCompleted)}{kpi("Jornadas publicadas", m.publishedJourneys)}</div>
      <div className="card"><h3>Temas mais procurados</h3>
        {m.topics.length === 0 ? <p className="muted small">Sem dados ainda.</p> : <table><thead><tr><th>Tema</th><th>Pessoas</th></tr></thead><tbody>
          {m.topics.map((t: any) => <tr key={t.name}><td>{t.name}</td><td>{t.users ?? "—"}</td></tr>)}</tbody></table>}</div></>}
  </div>;
}

const PAGE = 50;
export function AuditPanel() {
  const toast = useToast();
  const [a, setA] = useState<any[]>([]); const [loaded, setLoaded] = useState(false); const [q, setQ] = useState(""); const [page, setPage] = useState(0);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { call("GET", "/api/admin/audit").then(setA).catch((e) => toast(e.message, "error")).finally(() => setLoaded(true)); }, [toast]);
  const rows = useMemo(() => a.filter((x) => !q || `${x.action} ${x.entity}`.toLowerCase().includes(q.toLowerCase())), [a, q]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE)); const cur = Math.min(page, pages - 1);
  return <div>
    <PageHead title="Auditoria" description="Registro de ações editoriais: quem fez, o quê e quando. Todo envio de notificação e toda mudança de status entram aqui." />
    <div className="card toolbar"><input className="search" aria-label="Filtrar por ação ou entidade" placeholder="Filtrar por ação ou entidade" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
      <span className="small muted" role="status">{rows.length} registro(s)</span></div>
    <div className="card" style={{ overflowX: "auto", padding: 0 }}><table><thead><tr><th>Quando</th><th>Ação</th><th>Entidade</th></tr></thead><tbody>
      {rows.slice(cur * PAGE, (cur + 1) * PAGE).map((x) => <tr key={x.id}><td>{new Date(x.createdAt).toLocaleString("pt-BR")}</td><td>{x.action}</td><td>{x.entity}</td></tr>)}
      {loaded && rows.length === 0 && <tr><td colSpan={3} className="muted" style={{ padding: "1.25rem" }}>Nenhum registro.</td></tr>}</tbody></table></div>
    {pages > 1 && <div className="row" style={{ justifyContent: "center" }}><button className="chip" disabled={cur === 0} onClick={() => setPage(cur - 1)}>← Anterior</button>
      <span className="small muted">Página {cur + 1} de {pages}</span><button className="chip" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Próxima →</button></div>}
  </div>;
}
