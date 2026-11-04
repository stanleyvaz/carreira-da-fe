"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { call } from "@/lib/client";
import { STATUS_LABEL } from "@/lib/adminLabels";
import PageHead from "./PageHead";
import StatusBadge from "./StatusBadge";
import { useToast } from "./Toast";

const NAMES: Record<string, [label: string, slug: string]> = { journey: ["Jornadas e desafios", "jornadas"], reflection: ["Reflexões", "reflexoes"], activity: ["Exercícios", "exercicios"], song: ["Músicas", "musicas"], resource: ["Biblioteca", "indicacoes"] };
const STATUSES = ["draft", "in_review", "approved", "published", "archived"] as const;
type Pending = { id: string; title: string; type: string; updatedAt?: string };

export default function Dashboard({ role, promoteId }: { role: string; promoteId?: string }) {
  const toast = useToast();
  const [d, setD] = useState<any>(null); const [published, setPublished] = useState<any[]>([]); const [pending, setPending] = useState<Pending[] | null>(null);
  const [pick, setPick] = useState(promoteId ?? ""); const [headline, setHeadline] = useState(""); const [until, setUntil] = useState("");
  const canPromote = role === "admin" || role === "publisher";
  const load = useCallback(async () => {
    try {
      setD(await call("GET", "/api/admin/dashboard")); setPublished(await call("GET", "/api/admin/content?type=journey&status=published"));
      // Fila de revisão: o que está esperando outra pessoa agir, de todos os tipos.
      const lists = await Promise.all(Object.keys(NAMES).map((t) => call<any[]>("GET", `/api/admin/content?type=${t}&status=in_review`).then((r) => r.map((x) => ({ id: x.id, title: x.title, type: t, updatedAt: x.updatedAt })), () => [] as Pending[])));
      setPending(lists.flat().sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")));
    } catch (e: any) { toast(e.message, "error"); }
  }, [toast]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  const n = (t: string, s: string) => d?.counts.find((x: any) => x.t === t && x.status === s)?.n ?? 0;
  const total = (s: string) => Object.keys(NAMES).reduce((a, t) => a + n(t, s), 0);
  const href = (p: Pending) => p.type === "song" || p.type === "resource" ? `/admin/lista/${NAMES[p.type][1]}` : `/admin/editar/${p.type}/${p.id}`;
  async function promote() {
    try { await call("POST", `/api/admin/journeys/${pick}/promote`, { headline, until: until ? new Date(until).toISOString() : null }); toast("Destaque atualizado. O app mostra este item na tela Hoje."); setHeadline(""); setPick(""); await load(); } catch (e: any) { toast(e.message, "error"); }
  }
  const kpi = (s: string, label: string, hot = false) => <div key={s} className="kpi" data-hot={hot && total(s) > 0}><b>{d ? total(s) : "–"}</b><span>{label}</span></div>;

  return <div>
    <PageHead title="Painel editorial" description="Visão geral do que precisa de ação. Nenhum conteúdo é publicado sem aprovação de outro perfil." />
    <div className="kpis" role="group" aria-label="Totais por status">
      {kpi("in_review", "Aguardando revisão", true)}{kpi("approved", "Aprovados, prontos para publicar")}{kpi("draft", "Rascunhos")}{kpi("published", "Publicados")}
    </div>

    <section className="card attn" aria-labelledby="attn-h">
      <header><h3 id="attn-h">Precisa de atenção</h3><span className="small muted">{pending ? `${pending.length} em revisão` : "Carregando…"}</span></header>
      {pending && pending.length === 0 && <p className="empty">Nada esperando revisão agora. 🎉</p>}
      {pending && pending.length > 0 && <ul>{pending.slice(0, 8).map((p) => <li key={`${p.type}-${p.id}`}>
        <div><Link href={href(p)}>{p.title}</Link><small>{NAMES[p.type][0]}{p.updatedAt ? ` · atualizado em ${new Date(p.updatedAt).toLocaleDateString("pt-BR")}` : ""}</small></div>
        <StatusBadge status="in_review" /></li>)}</ul>}
      {pending && pending.length > 8 && <p className="small muted" style={{ padding: ".6rem 1.25rem", margin: 0 }}>E mais {pending.length - 8}. Abra a lista de cada seção para ver todos.</p>}
    </section>

    {d && <>
      <div className="typegrid">{Object.entries(NAMES).map(([t, [label, slug]]) => {
        const sum = STATUSES.reduce((a, s) => a + n(t, s), 0);
        return <div key={t} className="card"><div className="row" style={{ justifyContent: "space-between" }}><h3 style={{ margin: 0 }}>{label}</h3><Link href={`/admin/lista/${slug}`} className="small">Abrir lista →</Link></div>
          <div className="stack" role="img" aria-label={`${sum} itens: ${STATUSES.map((s) => `${n(t, s)} ${STATUS_LABEL[s].toLowerCase()}`).join(", ")}`}>
            {STATUSES.map((s) => n(t, s) > 0 && <i key={s} data-s={s} style={{ width: `${(n(t, s) / sum) * 100}%` }} />)}</div>
          <div className="legendrow">{STATUSES.map((s) => <span key={s}>{STATUS_LABEL[s]} <b>{n(t, s)}</b></span>)}</div></div>;
      })}</div>

      <div className="card"><h3>★ Destaque na tela Hoje</h3>
        {d.featured ? <><p><strong>{d.featured.title}</strong><br /><span className="muted">“{d.featured.headline}”{d.featured.until ? ` · até ${new Date(d.featured.until).toLocaleString("pt-BR")}` : ""}</span></p>
          {canPromote && <button className="btn danger" onClick={async () => { try { await call("DELETE", `/api/admin/journeys/${d.featured.id}/promote`); toast("Destaque removido."); await load(); } catch (e: any) { toast(e.message, "error"); } }}>Remover destaque</button>}</>
          : <p className="muted">Nenhum item em destaque. O app mostra a sugestão padrão.</p>}
        {canPromote && <div style={{ marginTop: "1rem" }}><h3>{d.featured ? "Trocar destaque" : "Promover um item publicado"}</h3>
          <div className="grid2"><div className="field"><label htmlFor="pk">Jornada ou desafio publicado</label><select id="pk" value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Escolha…</option>{published.map((j) => <option key={j.id} value={j.id}>{j.kind === "challenge" ? "Desafio · " : ""}{j.title}</option>)}</select></div>
            <div className="field"><label htmlFor="hl">Chamada (aparece no app)</label><input id="hl" value={headline} maxLength={120} onChange={(e) => setHeadline(e.target.value)} placeholder="Ex.: Uma semana para agradecer" /></div>
            <div className="field"><label htmlFor="un">Até (opcional)</label><input id="un" type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} /></div></div>
          <button className="btn" disabled={!pick || headline.trim().length < 3} onClick={promote}>Promover</button>
          <p className="small muted" style={{ marginTop: ".6rem" }}>Um único item fica em destaque por vez. A promoção não altera o conteúdo nem cria pontuação para quem participa.</p></div>}
      </div></>}
  </div>;
}
