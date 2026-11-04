"use client";
import { useEffect, useState } from "react";
import { call } from "@/lib/client";
import PageHead from "./PageHead";
import StatusBadge from "./StatusBadge";
import { useToast } from "./Toast";

const nf = new Intl.NumberFormat("pt-BR");
/** null = grupo com menos de 5 pessoas (suprimido para não identificar ninguém). */
const v = (n: number | null | undefined, suffix = "") => n === null || n === undefined ? <abbr title="Menos de 5 pessoas: ocultado para proteger a privacidade" style={{ textDecoration: "none" }}>&lt;5</abbr> : <>{nf.format(n)}{suffix}</>;
const pct = (n: number | null | undefined) => (n === null || n === undefined ? <span title="Base com menos de 5 pessoas">—</span> : <>{nf.format(n)}%</>);
const dur = (s: number) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, "0")}s`);
const AREA: Record<string, string> = { hoje: "Hoje", aprender: "Aprender", exercitar: "Exercitar", minha: "Minha jornada", favoritos: "Favoritos e anotações", perfil: "Perfil" };
const COUNTRY = (c: string) => { try { return c === "??" ? "Não identificado" : new Intl.DisplayNames(["pt-BR"], { type: "region" }).of(c) ?? c; } catch { return c; } };
const KIND: Record<string, string> = { journey: "Jornada", challenge: "Desafio" };

function Kpi({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return <div className="kpi"><b>{value}</b><span>{label}</span>{hint && <small>{hint}</small>}</div>;
}
function Bars({ items }: { items: { label: string; value: number | null; text?: React.ReactNode }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value ?? 0));
  if (!items.length) return <p className="muted small">Sem dados no período.</p>;
  return <ul className="hbars">{items.map((i) => <li key={i.label}><span>{i.label}</span>
    <span className="bar" aria-hidden="true"><i style={{ width: `${((i.value ?? 0) / max) * 100}%` }} /></span><b>{i.text ?? v(i.value)}</b></li>)}</ul>;
}
function Spark({ series, field, label }: { series: any[]; field: string; label: string }) {
  const max = Math.max(1, ...series.map((x) => x[field] ?? 0));
  return <div><div className="spark" role="img" aria-label={`${label} por dia`}>
    {series.map((x) => <i key={x.day} data-null={x[field] === null} title={`${new Date(`${x.day}T12:00:00`).toLocaleDateString("pt-BR")}: ${x[field] ?? "<5"}`}
      style={{ height: `${x[field] === null ? 6 : Math.max(2, (x[field] / max) * 100)}%` }} />)}</div>
    <div className="sparkaxis"><span>{series[0] && new Date(`${series[0].day}T12:00:00`).toLocaleDateString("pt-BR")}</span><span>{label}</span><span>hoje</span></div></div>;
}

function Funnel({ id, days, onClose }: { id: string; days: number; onClose: () => void }) {
  const toast = useToast(); const [f, setF] = useState<any>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { call("GET", `/api/admin/metrics/journeys/${id}?days=${days}`).then(setF).catch((e) => toast(e.message, "error")); }, [id, days, toast]);
  if (!f) return <div className="card muted">Carregando funil…</div>;
  return <div className="card" aria-live="polite">
    <div className="row" style={{ justifyContent: "space-between" }}><h3 style={{ margin: 0 }}>Funil: {f.title}</h3><button className="chip" onClick={onClose}>Fechar</button></div>
    <p className="note">Pessoas que concluíram cada etapa (desde o início) e aberturas da etapa nos últimos {days} dias. Uma queda grande entre duas etapas indica onde as pessoas param.</p>
    <Bars items={f.steps.map((s: any) => ({ label: `Dia ${s.position} · ${s.title}`, value: s.completed, text: <>{v(s.completed)} <span className="muted small">· {nf.format(s.opens)} aberturas</span></> }))} />
    <h3 style={{ marginTop: "1rem" }}>Aberturas da jornada por dia</h3><Spark series={f.opens} field="opens" label="aberturas" />
  </div>;
}

export function MetricsDashboard() {
  const toast = useToast();
  const [days, setDays] = useState(30); const [m, setM] = useState<any>(null); const [c, setC] = useState<any>(null); const [funnel, setFunnel] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([call("GET", `/api/admin/metrics?days=${days}`), call("GET", `/api/admin/metrics/content?days=${days}`)])
      .then(([a, b]) => { if (alive) { setM(a); setC(b); } }).catch((e) => toast(e.message, "error"));
    return () => { alive = false; };
  }, [days, toast]);

  return <div>
    <PageHead title="Indicadores de uso" description="Somente números agregados e anônimos (LGPD). Grupos com menos de 5 pessoas aparecem como “<5”. Nenhum nome, e-mail, IP ou texto de anotação é usado aqui."
      actions={<div className="period" role="group" aria-label="Período">{[7, 30, 90, 365].map((d) =>
        <button key={d} className="chip" aria-pressed={days === d} onClick={() => { setDays(d); setFunnel(null); }}>{d === 365 ? "12 meses" : `${d} dias`}</button>)}</div>} />
    {!m && <p className="muted">Carregando…</p>}
    {m && <>
      <div className="kpis">
        <Kpi label="Contas cadastradas" value={v(m.users.registered)} hint={`${nf.format(m.users.newInPeriod)} novas no período`} />
        <Kpi label="Ativas hoje" value={v(m.users.activeToday)} />
        <Kpi label="Ativas em 7 dias" value={v(m.users.activePeriod === null ? null : m.users.active7)} />
        <Kpi label={`Ativas em ${days} dias`} value={v(m.users.activePeriod)} />
        <Kpi label="Média de pessoas por dia" value={m.users.avgDailyActive === null ? "—" : nf.format(m.users.avgDailyActive)} />
        <Kpi label="Dias de uso por pessoa" value={m.users.avgActiveDaysPerUser === null ? "—" : nf.format(m.users.avgActiveDaysPerUser)} hint="no período, entre quem usou" />
        <Kpi label="Engajamento diário" value={pct(m.users.stickiness)} hint="média diária ÷ ativas no período" />
        <Kpi label="Voltam na 1ª semana" value={pct(m.users.retention7)} hint="usaram de novo 1 a 7 dias após o cadastro" />
        <Kpi label="Voltam no 1º mês" value={pct(m.users.retention30)} hint="usaram de novo 8 a 30 dias após o cadastro" />
      </div>

      <div className="grid3">
        <div className="card"><h3>Pessoas ativas por dia</h3><Spark series={m.series} field="active" label="ativas" /></div>
        <div className="card"><h3>Cadastros por dia</h3><Spark series={m.series} field="signups" label="cadastros" /></div>
      </div>

      <div className="grid3" style={{ marginTop: ".75rem" }}>
        <div className="card"><h3>Começam e terminam</h3>
          <div className="kpis">
            <Kpi label="Jornadas começadas" value={nf.format(m.completion.journeysStarted)} />
            <Kpi label="Concluídas" value={nf.format(m.completion.journeysCompleted)} hint={m.completion.completionRate === null ? undefined : `${nf.format(m.completion.completionRate)}% das começadas`} />
            <Kpi label="Em andamento" value={nf.format(m.completion.journeysInProgress)} />
            <Kpi label="Abandonadas" value={nf.format(m.completion.journeysAbandoned)} hint={`paradas há mais de ${m.completion.abandonAfterDays} dias`} />
          </div>
          <p className="small">Pessoas que terminaram ao menos uma jornada que começaram: <b>{pct(m.completion.usersFinishRate)}</b> ({v(m.completion.usersCompleted)} de {v(m.completion.usersStarted)}).</p>
          <p className="note">No período: {nf.format(m.completion.period.steps)} etapas, {nf.format(m.completion.period.reflections)} reflexões e {nf.format(m.completion.period.activities)} práticas concluídas, por {v(m.completion.period.usersAny)} pessoas.</p>
        </div>
        <div className="card"><h3>Áreas do app</h3>
          <Bars items={m.areas.items.map((a: any) => ({ label: AREA[a.area] ?? a.area, value: a.totalMinutes, text: <>{dur(a.avgSeconds)} <span className="muted small">por visita · {nf.format(a.visits)} visitas</span></> }))} />
          <p className="note">Tempo medido só para quem autorizou estatísticas de uso no app ({v(m.areas.consenting)} pessoas). A barra mostra o tempo total; o número, o tempo médio por visita.</p>
        </div>
      </div>

      <div className="grid3" style={{ marginTop: ".75rem" }}>
        <div className="card"><h3>Por país</h3><Bars items={m.geo.countries.map((g: any) => ({ label: COUNTRY(g.country), value: g.userDays }))} /></div>
        <div className="card"><h3>Por estado (Brasil)</h3><Bars items={m.geo.regionsBR.map((g: any) => ({ label: g.region, value: g.userDays }))} />
          <p className="note">Soma de pessoas únicas por dia. Localização aproximada pelo endereço de rede no momento do acesso; o endereço não é guardado. Base: <a href="https://db-ip.com" target="_blank" rel="noreferrer">IP Geolocation by DB-IP</a> (CC BY 4.0).</p></div>
        <div className="card"><h3>Biblioteca pessoal</h3>
          <div className="kpis"><Kpi label="Anotações" value={nf.format(m.library.notes)} hint={`${nf.format(m.library.notesInPeriod)} no período`} />
            <Kpi label="Pessoas com anotações" value={v(m.library.usersWithNotes)} />
            <Kpi label="Favoritos" value={nf.format(m.library.bookmarks)} hint={`${nf.format(m.library.bookmarksInPeriod)} no período`} />
            <Kpi label="Pessoas com favoritos" value={v(m.library.usersWithBookmarks)} /></div>
          <h3>Versículos mais favoritados</h3>
          <Bars items={m.library.topPassages.map((p: any) => ({ label: p.reference, value: p.users }))} />
          <p className="note">Só aparecem versículos favoritados por 5 pessoas ou mais.</p></div>
      </div>

      <div className="grid3" style={{ marginTop: ".75rem" }}>
        <div className="card"><h3>Temas mais estudados</h3><Bars items={m.topics.map((t: any) => ({ label: t.name, value: t.users }))} /></div>
        <div className="card"><h3>Aparelhos com notificações</h3><Bars items={m.devices.map((d: any) => ({ label: d.platform === "ios" ? "iPhone/iPad" : d.platform, value: d.users }))} /></div>
      </div>
    </>}

    {c && <>
      <h2 style={{ marginTop: "1.5rem" }}>Conteúdos</h2>
      {funnel && <Funnel id={funnel} days={days} onClose={() => setFunnel(null)} />}
      <div className="card tablewrap"><table className="dtable"><thead><tr>
        <th>Jornada ou desafio</th><th className="num">Aberturas</th><th className="num">Inícios</th><th className="num">Em andamento</th><th className="num">Concluídas</th>
        <th className="num">Abandonos</th><th className="num">Conclusão</th><th className="num">Dias p/ concluir</th><th className="num">Favoritos</th><th className="num">Anotações</th><th><span className="sr-only">Funil</span></th></tr></thead><tbody>
        {c.journeys.map((j: any) => <tr key={j.id}><td><b>{j.title}</b><br /><span className="small muted">{KIND[j.kind] ?? j.kind} · {j.topic ?? "—"} · {j.steps} etapas</span> {j.status !== "published" && <StatusBadge status={j.status} />}</td>
          <td className="num">{nf.format(j.opens)}</td><td className="num">{v(j.starts)}</td><td className="num">{v(j.inProgress)}</td><td className="num">{v(j.completed)}</td>
          <td className="num">{v(j.abandoned)}</td><td className="num">{pct(j.completionRate)}</td><td className="num">{j.avgDaysToComplete ?? "—"}</td>
          <td className="num">{nf.format(j.bookmarks)}</td><td className="num">{nf.format(j.notes)}</td>
          <td><button className="chip" onClick={() => setFunnel(j.id)} aria-label={`Ver funil de ${j.title}`}>Funil</button></td></tr>)}
        {c.journeys.length === 0 && <tr><td colSpan={11} className="muted" style={{ padding: "1.25rem" }}>Nenhuma jornada publicada.</td></tr>}
      </tbody></table></div>
      <p className="note">Aberturas contam visualizações no período (todas as pessoas, sem identificar ninguém). Inícios, andamento, conclusões e abandonos contam pessoas desde o lançamento; abandono = parada há mais de {c.abandonAfterDays} dias sem concluir.</p>
      <div className="grid3">
        <div className="card"><h3>Reflexões do período</h3><Bars items={c.reflections.slice(0, 15).map((r: any) => ({ label: `${new Date(`${r.publishDate}T12:00:00`).toLocaleDateString("pt-BR")} · ${r.title}`, value: r.completed }))} /></div>
        <div className="card"><h3>Práticas mais feitas</h3><Bars items={c.activities.slice(0, 15).map((a: any) => ({ label: a.title, value: a.completed }))} /></div>
        <div className="card"><h3>Biblioteca: mais abertos</h3><Bars items={c.resources.filter((r: any) => r.opens > 0).slice(0, 15).map((r: any) => ({ label: r.title, value: r.opens, text: nf.format(r.opens) }))} /></div>
      </div>
    </>}
  </div>;
}
