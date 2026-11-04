"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { call } from "@/lib/client";

const ICON: Record<string, string> = {
  painel: "M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z",
  jornadas: "M9 20l-6-2V5l6 2 6-2 6 2v13l-6-2-6 2z M9 7v13 M15 5v13",
  desafios: "M4 21V4 M4 4h13l-2 4 2 4H4",
  reflexoes: "M2 4h7a3 3 0 013 3v13a2 2 0 00-2-2H2z M22 4h-7a3 3 0 00-3 3v13a2 2 0 012-2h8z",
  exercicios: "M20.8 5.6a5 5 0 00-7.1 0L12 7.3l-1.7-1.7a5 5 0 00-7.1 7.1L12 21l8.8-8.3a5 5 0 000-7.1z",
  musicas: "M9 18V5l12-2v13 M6 21a3 3 0 100-6 3 3 0 000 6z M18 19a3 3 0 100-6 3 3 0 000 6z",
  biblioteca: "M4 4h4v16H4z M10 4h4v16h-4z M16 6l4 1-3 13-4-1z",
  notificacoes: "M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 01-3.4 0",
  temas: "M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L2 12V2h10l8.6 8.6a2 2 0 010 2.8z M7 7h.01",
  equipe: "M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2 M10 11a4 4 0 100-8 4 4 0 000 8z M21 21v-2a4 4 0 00-3-3.9 M16 3.1a4 4 0 010 7.8",
  indicadores: "M4 20V10 M10 20V4 M16 20v-8 M22 20H2",
  auditoria: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4",
  menu: "M4 6h16 M4 12h16 M4 18h16",
};
const Icon = ({ k }: { k: string }) => <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={ICON[k]} /></svg>;

type Item = readonly [href: string, label: string, icon: string];
const GROUPS: readonly { label: string | null; items: readonly Item[] }[] = [
  { label: null, items: [["/admin", "Painel", "painel"]] },
  { label: "Conteúdo", items: [["/admin/lista/jornadas", "Jornadas", "jornadas"], ["/admin/lista/desafios", "Desafios", "desafios"], ["/admin/lista/reflexoes", "Reflexões diárias", "reflexoes"],
    ["/admin/lista/exercicios", "Exercícios", "exercicios"], ["/admin/lista/musicas", "Músicas", "musicas"], ["/admin/lista/indicacoes", "Biblioteca", "biblioteca"]] },
  { label: "Distribuição", items: [["/admin/notificacoes", "Notificações", "notificacoes"]] },
  { label: "Gestão", items: [["/admin/temas", "Temas", "temas"], ["/admin/equipe", "Equipe", "equipe"], ["/admin/indicadores", "Indicadores", "indicadores"], ["/admin/auditoria", "Auditoria", "auditoria"]] },
];
const ROLE_LABEL: Record<string, string> = { admin: "Administrador", editor: "Editor", reviewer: "Revisor", publisher: "Publicador" };

export default function AdminNav({ role, name }: { role: string; name: string }) {
  const p = usePathname(); const r = useRouter(); const [open, setOpen] = useState(false);
  const current = (h: string) => (h === "/admin" ? p === "/admin" : p.startsWith(h));
  return <aside className="admnav">
    <div className="navhead">
      <div className="navbrand"><b aria-hidden="true">C</b><span>Carreira da Fé<small>Editorial</small></span></div>
      <button type="button" className="chip navtoggle" aria-expanded={open} aria-controls="admnav-body" onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={ICON.menu} /></svg>&nbsp;Menu</button>
    </div>
    <div className="navbody" id="admnav-body" data-open={open}>
      {GROUPS.map((g, i) => <div key={i} className="navgroup">
        {g.label && <p className="navlabel" id={`ng-${i}`}>{g.label}</p>}
        <nav aria-label={g.label ?? "Principal"}>{g.items.map(([h, l, ic]) =>
          <Link key={h} href={h} aria-current={current(h) ? "page" : undefined} onClick={() => setOpen(false)}><Icon k={ic} />{l}</Link>)}</nav>
      </div>)}
      <div className="navfoot">
        <div className="navuser"><i aria-hidden="true">{(name.trim()[0] ?? "?").toUpperCase()}</i><span><b title={name}>{name}</b><small>{ROLE_LABEL[role] ?? role}</small></span></div>
        <div className="row"><Link href="/" className="chip" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>← App</Link>
          <button type="button" className="chip" onClick={async () => { await call("POST", "/api/auth/logout"); r.replace("/entrar"); r.refresh(); }}>Sair</button></div>
      </div>
    </div>
  </aside>;
}
