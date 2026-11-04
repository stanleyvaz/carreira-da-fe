"use client";
import { useCallback, useEffect, useState } from "react";
import { call } from "@/lib/client";
import PageHead from "./PageHead";
import { useDialog } from "./Dialog";
import { useToast } from "./Toast";

const fmtDate = (s?: string | null) => (s ? new Date(s.length === 10 ? `${s}T12:00:00` : s).toLocaleDateString("pt-BR") : "—");
const STATUS = [["all", "Todos"], ["active", "Ativos"], ["blocked", "Bloqueados"], ["pending", "Aguardando troca de senha"]] as const;

function State({ u }: { u: any }) {
  if (u.blockedAt) return <span className="ustate" data-s="blocked">⛔ Bloqueado</span>;
  if (u.mustChangePassword) return <span className="ustate" data-s="pending">⏳ Senha temporária</span>;
  return <span className="ustate">● Ativo</span>;
}

/** Mostra a senha temporária uma única vez, com botão de copiar. */
function Secret({ value, onClose }: { value: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return <div className="card" role="alert" style={{ borderColor: "var(--accent)" }}>
    <h3>Senha temporária</h3>
    <p className="small">Entregue à pessoa por um canal seguro. Ela será obrigada a trocar no primeiro acesso. <b>Esta senha não será mostrada de novo.</b></p>
    <div className="row"><code className="secret">{value}</code>
      <button className="chip" onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); }}>{copied ? "Copiada ✓" : "Copiar"}</button>
      <button className="btn ghost" onClick={onClose}>Já anotei</button></div>
  </div>;
}

export function AppUsersPanel({ role }: { role: string }) {
  const toast = useToast(); const dialog = useDialog();
  const [data, setData] = useState<{ rows: any[]; total: number; page: number; pageSize: number } | null>(null);
  const [q, setQ] = useState(""); const [status, setStatus] = useState("all"); const [page, setPage] = useState(0);
  const [open, setOpen] = useState<any>(null); const [secret, setSecret] = useState<string | null>(null);
  const [creating, setCreating] = useState(false); const [nEmail, setNEmail] = useState(""); const [nName, setNName] = useState("");

  const load = useCallback(async () => {
    try { setData(await call("GET", `/api/admin/app-users?${new URLSearchParams({ q, status, page: String(page) })}`)); } catch (e: any) { toast(e.message, "error"); }
  }, [q, status, page, toast]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (role === "admin") { const t = setTimeout(() => void load(), 250); return () => clearTimeout(t); } }, [load, role]);

  async function detail(id: string) { try { setOpen(await call("GET", `/api/admin/app-users/${id}`)); } catch (e: any) { toast(e.message, "error"); } }
  async function patch(id: string, body: object, msg: string) {
    try { await call("PATCH", `/api/admin/app-users/${id}`, body); toast(msg); await load(); await detail(id); } catch (e: any) { toast(e.message, "error"); }
  }
  async function create() {
    try { const r = await call("POST", "/api/admin/app-users", { email: nEmail, displayName: nName || null }); setSecret(r.temporaryPassword); setCreating(false); setNEmail(""); setNName(""); toast("Conta criada."); await load(); await detail(r.id); }
    catch (e: any) { toast(e.message, "error"); }
  }

  if (role !== "admin") return <div><PageHead title="Usuários do app" /><p className="card muted">Somente administradores gerenciam contas de usuários.</p></div>;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return <div>
    <PageHead title="Usuários do app" description="Contas de quem usa o aplicativo. Aqui aparecem só dados cadastrais e contagens; o conteúdo das anotações nunca é visível. Toda ação fica registrada na auditoria."
      actions={<button className="btn" onClick={() => setCreating(!creating)}>{creating ? "Cancelar" : "Nova conta"}</button>} />
    {secret && <Secret value={secret} onClose={() => setSecret(null)} />}
    {creating && <form className="card" onSubmit={(e) => { e.preventDefault(); void create(); }}><h3>Nova conta</h3>
      <div className="grid2"><div className="field"><label htmlFor="nu-email">E-mail</label><input id="nu-email" type="email" required value={nEmail} onChange={(e) => setNEmail(e.target.value)} /></div>
        <div className="field"><label htmlFor="nu-name">Nome (opcional)</label><input id="nu-name" maxLength={80} value={nName} onChange={(e) => setNName(e.target.value)} /></div></div>
      <p className="hint">Geramos uma senha temporária, mostrada uma única vez. A pessoa troca no primeiro acesso.</p>
      <button className="btn" disabled={!nEmail}>Criar conta</button></form>}

    <div className="card toolbar">
      <input className="search" aria-label="Buscar por e-mail ou nome" placeholder="Buscar por e-mail ou nome" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
      <select aria-label="Situação" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>{STATUS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <span className="small muted" role="status">{data ? `${data.total} conta(s)` : "Carregando…"}</span>
    </div>

    {open && <div className="card" aria-live="polite">
      <div className="row" style={{ justifyContent: "space-between" }}><h3 style={{ margin: 0 }}>{open.displayName || open.email}</h3><button className="chip" onClick={() => setOpen(null)}>Fechar</button></div>
      <p className="small muted">{open.email} · cadastro em {fmtDate(open.createdAt)} · último uso {fmtDate(open.lastActiveDay)} · <State u={open} /></p>
      <div className="kpis">
        {[["Dias de uso (30d)", open.activeDays30], ["Jornadas começadas", open.journeysStarted], ["Itens concluídos", open.itemsCompleted], ["Anotações", open.notes], ["Favoritos", open.bookmarks], ["Aparelhos", open.devices]]
          .map(([l, v]) => <div key={l as string} className="kpi"><b>{v as number}</b><span>{l}</span></div>)}
      </div>
      <form className="grid2" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void patch(open.id, { email: f.get("email"), displayName: f.get("name") || null }, "Dados atualizados."); }}>
        <div className="field"><label htmlFor="ed-email">E-mail</label><input id="ed-email" name="email" type="email" defaultValue={open.email} key={`e${open.id}${open.email}`} required /></div>
        <div className="field"><label htmlFor="ed-name">Nome</label><input id="ed-name" name="name" maxLength={80} defaultValue={open.displayName ?? ""} key={`n${open.id}${open.displayName}`} /></div>
        <div className="row"><button className="btn">Salvar dados</button></div>
      </form>
      <div className="row" style={{ marginTop: ".75rem" }}>
        {open.blockedAt
          ? <button className="chip" onClick={() => patch(open.id, { blocked: false }, "Conta desbloqueada.")}>Desbloquear</button>
          : <button className="chip danger" onClick={async () => { if (await dialog.confirm("A pessoa é desconectada de todos os aparelhos e não consegue entrar até ser desbloqueada. Nada é apagado.", { title: "Bloquear conta", confirmLabel: "Bloquear", danger: true })) void patch(open.id, { blocked: true }, "Conta bloqueada."); }}>Bloquear</button>}
        <button className="chip" onClick={async () => {
          if (!(await dialog.confirm("Gera uma nova senha temporária, desconecta todos os aparelhos e obriga a troca no próximo acesso.", { title: "Redefinir senha", confirmLabel: "Redefinir" }))) return;
          try { const r = await call("POST", `/api/admin/app-users/${open.id}/reset-password`); setSecret(r.temporaryPassword); await load(); await detail(open.id); } catch (e: any) { toast(e.message, "error"); }
        }}>Redefinir senha</button>
        <button className="chip danger" onClick={async () => {
          if (!(await dialog.confirm(`Apaga a conta de ${open.email} e todos os dados pessoais (progresso, favoritos, anotações, aparelhos). Não pode ser desfeito.`, { title: "Excluir conta definitivamente", confirmLabel: "Excluir para sempre", danger: true }))) return;
          try { await call("DELETE", `/api/admin/app-users/${open.id}`); toast("Conta excluída."); setOpen(null); await load(); } catch (e: any) { toast(e.message, "error"); }
        }}>Excluir conta</button>
      </div>
    </div>}

    <div className="card tablewrap"><table className="dtable"><thead><tr><th>Conta</th><th>Cadastro</th><th>Último uso</th><th>Situação</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>
      {data?.rows.map((u) => <tr key={u.id}><td><b>{u.displayName || "—"}</b><br /><span className="small muted">{u.email}</span></td>
        <td>{fmtDate(u.createdAt)}</td><td>{fmtDate(u.lastActiveDay)}</td><td><State u={u} /></td>
        <td><button className="chip" onClick={() => detail(u.id)} aria-label={`Abrir ${u.email}`}>Abrir</button></td></tr>)}
      {data && data.rows.length === 0 && <tr><td colSpan={5} className="muted" style={{ padding: "1.25rem" }}>Nenhuma conta encontrada.</td></tr>}
    </tbody></table></div>
    {pages > 1 && <div className="row" style={{ justifyContent: "center" }}><button className="chip" disabled={page === 0} onClick={() => setPage(page - 1)}>← Anterior</button>
      <span className="small muted">Página {page + 1} de {pages}</span><button className="chip" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Próxima →</button></div>}
  </div>;
}
