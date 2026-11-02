"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { call } from "@/lib/client";
import { STATUS_LABEL } from "@/lib/adminLabels";

const NAMES: Record<string, [string, string]> = { journey: ["Jornadas e desafios", "jornadas"], reflection: ["Reflexões", "reflexoes"], activity: ["Exercícios", "exercicios"], song: ["Músicas", "musicas"], resource: ["Indicações", "indicacoes"] };
export default function Dashboard({ role, promoteId }: { role: string; promoteId?: string }) {
  const [d, setD] = useState<any>(null); const [published, setPublished] = useState<any[]>([]); const [msg, setMsg] = useState("");
  const [pick, setPick] = useState(promoteId ?? ""); const [headline, setHeadline] = useState(""); const [until, setUntil] = useState("");
  const canPromote = role === "admin" || role === "publisher";
  const load = useCallback(async () => {
    try { setD(await call("GET", "/api/admin/dashboard")); setPublished(await call("GET", "/api/admin/content?type=journey&status=published")); } catch (e: any) { setMsg(e.message); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  const n = (t: string, s: string) => d?.counts.find((x: any) => x.t === t && x.status === s)?.n ?? 0;
  async function promote() {
    try { await call("POST", `/api/admin/journeys/${pick}/promote`, { headline, until: until ? new Date(until).toISOString() : null }); setMsg("Destaque atualizado. O app mostra este item na tela Hoje."); setHeadline(""); setPick(""); await load(); } catch (e: any) { setMsg(e.message); }
  }
  return <div><h1>Painel editorial</h1><p className="muted">Nenhum conteúdo é publicado sem aprovação de outro perfil.</p>
    {msg && <p role="status" className="small">{msg}</p>}
    {d && <>
      {Object.entries(NAMES).map(([t, [label, slug]]) => <div key={t} className="card"><div className="row" style={{ justifyContent: "space-between" }}><h3 style={{ margin: 0 }}>{label}</h3><Link href={`/admin/lista/${slug}`} className="small">Abrir lista →</Link></div>
        <div className="stats" style={{ marginTop: ".75rem", gridTemplateColumns: "repeat(5,1fr)" }}>{["draft", "in_review", "approved", "published", "archived"].map((s) => <Link key={s} href={`/admin/lista/${slug}`} className="stat" style={{ textDecoration: "none", color: "inherit", background: s === "in_review" && n(t, s) ? "var(--accent-soft)" : undefined }}><b>{n(t, s)}</b><span>{STATUS_LABEL[s]}</span></Link>)}</div></div>)}
      <div className="card"><h3>★ Destaque na tela Hoje</h3>
        {d.featured ? <><p><strong>{d.featured.title}</strong><br /><span className="muted">“{d.featured.headline}”{d.featured.until ? ` · até ${new Date(d.featured.until).toLocaleString("pt-BR")}` : ""}</span></p>
          {canPromote && <button className="btn danger" onClick={async () => { await call("DELETE", `/api/admin/journeys/${d.featured.id}/promote`); await load(); }}>Remover destaque</button>}</>
          : <p className="muted">Nenhum item em destaque. O app mostra a sugestão padrão.</p>}
        {canPromote && <div style={{ marginTop: "1rem" }}><h3>{d.featured ? "Trocar destaque" : "Promover um item publicado"}</h3>
          <div className="grid2"><div className="field"><label htmlFor="pk">Jornada ou desafio publicado</label><select id="pk" value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Escolha…</option>{published.map((j) => <option key={j.id} value={j.id}>{j.kind === "challenge" ? "Desafio · " : ""}{j.title}</option>)}</select></div>
            <div className="field"><label htmlFor="hl">Chamada (aparece no app)</label><input id="hl" value={headline} maxLength={120} onChange={(e) => setHeadline(e.target.value)} placeholder="Ex.: Uma semana para agradecer" /></div>
            <div className="field"><label htmlFor="un">Até (opcional)</label><input id="un" type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} /></div></div>
          <button className="btn" disabled={!pick || headline.trim().length < 3} onClick={promote}>Promover</button>
          <p className="small muted">Um único item fica em destaque por vez. A promoção não altera o conteúdo nem cria pontuação para quem participa.</p></div>}
      </div></>}
  </div>;
}
