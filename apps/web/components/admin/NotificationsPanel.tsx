"use client";
import { useCallback, useEffect, useState } from "react";
import { call } from "@/lib/client";
import type { Role } from "@jornada/shared";
import PageHead from "./PageHead";
import { useDialog } from "./Dialog";
import { useToast } from "./Toast";
type Topic = { id: string; slug: string; name: string };
const EMPTY = { title: "", body: "", linkKind: "none", linkId: "", target: "all", topicSlug: "" };
export default function NotificationsPanel({ role, topics }: { role: Role; topics: Topic[] }) {
  const [rows, setRows] = useState<any[]>([]); const [f, setF] = useState(EMPTY); const [editing, setEditing] = useState<string | null>(null);
  const [options, setOptions] = useState<{ id: string; title: string }[]>([]); const toast = useToast(); const dialog = useDialog();
  const canSend = role === "admin" || role === "publisher";
  const load = useCallback(async () => { try { setRows(await call("GET", "/api/admin/notifications")); } catch (e: any) { toast(e.message, "error"); } }, [toast]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (f.linkKind !== "resource" && f.linkKind !== "journey") return;
    void call("GET", `/api/admin/content?type=${f.linkKind}&status=published`).then(setOptions).catch(() => setOptions([]));
  }, [f.linkKind]);
  const payload = () => ({ title: f.title, body: f.body, linkKind: f.linkKind, linkId: f.linkId || null, target: f.target, topicSlug: f.target === "topic" ? f.topicSlug : null });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try { if (editing) await call("PUT", `/api/admin/notifications/${editing}`, payload()); else await call("POST", "/api/admin/notifications", payload());
      setF(EMPTY); setEditing(null); toast("Rascunho salvo."); await load(); } catch (x: any) { toast(x.message, "error"); }
  }
  async function send(r: any) {
    try { const { recipients } = await call("GET", `/api/admin/notifications/${r.id}`);
      if (!(await dialog.confirm(`“${r.title}” será enviada para ${recipients} pessoa(s). Não é possível desfazer.`, { title: "Enviar notificação", confirmLabel: "Enviar agora", danger: true }))) return;
      const out = await call("POST", `/api/admin/notifications/${r.id}/send`, {});
      toast(`Enviado a ${out.recipients} pessoa(s). Push: ${out.pushSent} enviados, ${out.pushDeferred} adiados (silêncio), ${out.pushSkipped + out.pushFailed} não enviados.`); await load();
    } catch (x: any) { toast(x.message, "error"); }
  }
  async function test(r: any) { try { const o = await call("POST", `/api/admin/notifications/${r.id}/send`, { test: true }); toast(`Teste: ${o.results.map((x: any) => x.status + (x.error ? ` (${x.error})` : "")).join("; ")}`); } catch (x: any) { toast(x.message, "error"); } }
  return <div>
    <PageHead title="Notificações" description="Cada pessoa recebe apenas se ativou “novos conteúdos”, respeitando horário de silêncio e o teto semanal que ela escolheu. Todo envio entra na auditoria. O aviso também aparece em “Novidades” no app, mesmo sem push." />
    <form onSubmit={save} className="card"><h3>{editing ? "Editar rascunho" : "Nova notificação"}</h3>
      <div className="field"><label htmlFor="nt">Título (até 80)</label><input id="nt" value={f.title} maxLength={80} required minLength={3} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
      <div className="field"><label htmlFor="nb">Mensagem (até 240)</label><textarea id="nb" value={f.body} maxLength={240} required minLength={3} onChange={(e) => setF({ ...f, body: e.target.value })} /></div>
      <div className="grid2">
        <div className="field"><label htmlFor="nl">Abre</label><select id="nl" value={f.linkKind} onChange={(e) => setF({ ...f, linkKind: e.target.value, linkId: "" })}>
          <option value="none">Só o app</option><option value="today">Tela Hoje</option><option value="praticar">Exercitar</option><option value="resource">Um conteúdo da biblioteca</option><option value="journey">Uma jornada / desafio</option></select></div>
        {(f.linkKind === "resource" || f.linkKind === "journey") && <div className="field"><label htmlFor="ni">Qual (somente publicados)</label><select id="ni" required value={f.linkId} onChange={(e) => setF({ ...f, linkId: e.target.value })}><option value="">—</option>{options.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}</select></div>}
        <div className="field"><label htmlFor="ng">Para quem</label><select id="ng" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })}><option value="all">Todos</option><option value="topic">Quem estuda um tema</option></select></div>
        {f.target === "topic" && <div className="field"><label htmlFor="nz">Tema</label><select id="nz" required value={f.topicSlug} onChange={(e) => setF({ ...f, topicSlug: e.target.value })}><option value="">—</option>{topics.map((t) => <option key={t.id} value={t.slug}>{t.name}</option>)}</select></div>}
      </div>
      <div className="row"><button className="btn">Salvar rascunho</button>{editing && <button type="button" className="chip" onClick={() => { setEditing(null); setF(EMPTY); }}>Cancelar</button>}</div></form>
    <div className="card" style={{ padding: 0, overflowX: "auto" }}><table><thead><tr><th>Notificação</th><th>Situação</th><th>Ações</th></tr></thead><tbody>
      {rows.map((r) => <tr key={r.id}><td><strong>{r.title}</strong><div className="small muted">{r.body}</div><div className="small muted">{r.target === "topic" ? `Tema: ${r.topicSlug}` : "Todos"} · abre: {r.linkKind}</div></td>
        <td>{r.status === "sent" ? <><span className="sbadge" data-s="published"><i aria-hidden="true">●</i>Enviada</span><div className="small muted">{new Date(r.sentAt).toLocaleString("pt-BR")} · {r.recipients} pessoas · {r.opened} abriram · push {r.pushSent} ok / {r.pushPending} pendentes / {r.pushNotSent} não enviados</div></> : <span className="sbadge" data-s="draft"><i aria-hidden="true">✎</i>Rascunho</span>}</td>
        <td><div className="row">{r.status === "draft" && <>
          <button className="chip" onClick={() => { setEditing(r.id); setF({ title: r.title, body: r.body, linkKind: r.linkKind, linkId: r.linkId ?? "", target: r.target, topicSlug: r.topicSlug ?? "" }); }}>Editar</button>
          <button className="chip" onClick={() => test(r)}>Testar no meu aparelho</button>
          {canSend && <button className="chip" onClick={() => send(r)}>Enviar…</button>}
          <button className="chip" onClick={async () => { if (await dialog.confirm(`O rascunho “${r.title}” será excluído.`, { title: "Excluir rascunho", confirmLabel: "Excluir", danger: true })) { try { await call("DELETE", `/api/admin/notifications/${r.id}`); toast("Rascunho excluído."); await load(); } catch (x: any) { toast(x.message, "error"); } } }}>Excluir</button></>}</div></td></tr>)}
      {rows.length === 0 && <tr><td colSpan={3} className="muted" style={{ padding: "1.25rem" }}>Nenhuma notificação.</td></tr>}</tbody></table></div></div>;
}
