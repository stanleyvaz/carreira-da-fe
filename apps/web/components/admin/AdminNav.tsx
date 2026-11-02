"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { call } from "@/lib/client";
const ITEMS = [["/admin", "Painel"], ["/admin/lista/jornadas", "Jornadas"], ["/admin/lista/desafios", "Desafios"], ["/admin/lista/reflexoes", "Reflexões diárias"],
  ["/admin/lista/exercicios", "Exercícios"], ["/admin/lista/musicas", "Músicas"], ["/admin/lista/indicacoes", "Biblioteca"], ["/admin/notificacoes", "Notificações"], ["/admin/temas", "Temas"], ["/admin/equipe", "Equipe"], ["/admin/indicadores", "Indicadores"], ["/admin/auditoria", "Auditoria"]] as const;
export default function AdminNav({ role, name }: { role: string; name: string }) {
  const p = usePathname(); const r = useRouter();
  return <aside className="admnav"><p className="eyebrow">Carreira da Fé · Editorial</p>
    <nav aria-label="Administração">{ITEMS.map(([h, l]) => <Link key={h} href={h} aria-current={(h === "/admin" ? p === "/admin" : p.startsWith(h)) ? "page" : undefined}>{l}</Link>)}</nav>
    <div className="small muted" style={{ marginTop: "1rem" }}>{name}<br />Perfil: {role}</div>
    <Link href="/" className="small">← Voltar ao app</Link>{" "}
    <button className="chip" style={{ marginTop: ".5rem" }} onClick={async () => { await call("POST", "/api/auth/logout"); r.replace("/entrar"); r.refresh(); }}>Sair</button></aside>;
}
