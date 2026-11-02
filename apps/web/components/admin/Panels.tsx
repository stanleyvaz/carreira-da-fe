"use client";
import { useCallback, useEffect, useState } from "react";
import { call } from "@/lib/client";
import type { Role } from "@jornada/shared";

export function TopicsPanel({ role }: { role: Role }) {
  const [rows, setRows] = useState<any[]>([]); const [msg, setMsg] = useState(""); const [name, setName] = useState("");
  const load = useCallback(async () => setRows(await call("GET", "/api/admin/topics")), []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  const can = role === "admin" || role === "editor";
  async function save(r: any) { try { await call("POST", "/api/admin/topics", { id: r.id, name: r.name, description: r.description, sortOrder: Number(r.sortOrder) }); setMsg("Salvo."); await load(); } catch (e: any) { setMsg(e.message); } }
  return <div><h1>Temas</h1>{msg && <p role="status" className="small">{msg}</p>}
    {can && <div className="card row"><input aria-label="Novo tema" placeholder="Nome do novo tema" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
      <button className="btn" disabled={name.trim().length < 2} onClick={async () => { try { await call("POST", "/api/admin/topics", { name }); setName(""); await load(); } catch (e: any) { setMsg(e.message); } }}>Adicionar</button></div>}
    {rows.map((r, i) => <div key={r.id} className="card"><div className="grid2">
      <div className="field"><label>Nome</label><input disabled={!can} value={r.name} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></div>
      <div className="field"><label>Ordem</label><input type="number" disabled={!can} value={r.sortOrder} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, sortOrder: e.target.value } : x)))} /></div></div>
      <div className="field"><label>Descrição</label><input disabled={!can} value={r.description ?? ""} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} /></div>
      {can && <button className="chip" onClick={() => save(r)}>Salvar</button>}</div>)}</div>;
}

const ROLE_LABEL: Record<string, string> = { admin: "Administrador", editor: "Editor", reviewer: "Revisor de conteúdo", publisher: "Publicador", analyst: "Analista (indicadores)", user: "Usuário comum (remove acesso)" };
export function StaffPanel({ role }: { role: Role }) {
  const [rows, setRows] = useState<any[]>([]); const [msg, setMsg] = useState(""); const [email, setEmail] = useState(""); const [r, setR] = useState("editor");
  const load = useCallback(async () => { try { setRows(await call("GET", "/api/admin/users")); } catch (e: any) { setMsg(e.message); } }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  async function setRole(em: string, ro: string) { try { await call("PUT", "/api/admin/users", { email: em, role: ro }); setMsg("Perfil atualizado."); setEmail(""); await load(); } catch (e: any) { setMsg(e.message); } }
  if (role !== "admin") return <div><h1>Equipe</h1><p className="muted">Somente administradores gerenciam a equipe.</p></div>;
  return <div><h1>Equipe e perfis</h1><p className="muted">Quem pode criar, revisar, publicar e ver indicadores. A pessoa precisa ter criado a conta no app. Nenhum perfil vê dados individuais de uso.</p>
    {msg && <p role="status" className="small">{msg}</p>}
    <div className="card"><h3>Conceder ou alterar perfil</h3><div className="grid2"><div className="field"><label htmlFor="em">E-mail da conta</label><input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="field"><label htmlFor="ro">Perfil</label><select id="ro" value={r} onChange={(e) => setR(e.target.value)}>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div></div>
      <button className="btn" disabled={!email} onClick={() => setRole(email, r)}>Aplicar</button></div>
    <div className="card" style={{ overflowX: "auto", padding: 0 }}><table><thead><tr><th>Conta</th><th>Perfil</th><th /></tr></thead><tbody>
      {rows.map((u) => <tr key={u.id}><td>{u.email}</td><td>{ROLE_LABEL[u.role]}</td><td><button className="chip" onClick={() => { if (window.confirm(`Remover o acesso editorial de ${u.email}?`)) void setRole(u.email, "user"); }}>Remover acesso</button></td></tr>)}</tbody></table></div></div>;
}

export function MetricsPanel() {
  const [m, setM] = useState<any>(null); const [msg, setMsg] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { call("GET", "/api/admin/metrics").then(setM).catch((e) => setMsg(e.message)); }, []);
  return <div><h1>Indicadores agregados</h1>{msg && <p className="muted">{msg}</p>}
    {m && <div className="card"><p className="small muted">Grupos com menos de 5 pessoas aparecem como “—” para evitar identificação. Não há dados individuais.</p>
      <p>Usuários ativos (30 dias): <strong>{m.activeUsers30d ?? "—"}</strong></p><p>Etapas concluídas: <strong>{m.stepsCompleted}</strong></p><p>Jornadas publicadas: <strong>{m.publishedJourneys}</strong></p>
      <h3>Temas mais procurados</h3>{m.topics.length === 0 && <p className="muted small">Sem dados ainda.</p>}{m.topics.map((t: any) => <p key={t.name} className="small">{t.name}: {t.users ?? "—"}</p>)}</div>}</div>;
}
export function AuditPanel() {
  const [a, setA] = useState<any[]>([]); const [msg, setMsg] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { call("GET", "/api/admin/audit").then(setA).catch((e) => setMsg(e.message)); }, []);
  return <div><h1>Auditoria</h1>{msg && <p className="muted">{msg}</p>}<div className="card" style={{ overflowX: "auto", padding: 0 }}><table><thead><tr><th>Quando</th><th>Ação</th><th>Entidade</th></tr></thead><tbody>
    {a.map((x) => <tr key={x.id}><td>{new Date(x.createdAt).toLocaleString("pt-BR")}</td><td>{x.action}</td><td>{x.entity}</td></tr>)}</tbody></table></div></div>;
}
