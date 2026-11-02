"use client";
import { useRouter } from "next/navigation";
import { call } from "@/lib/client";
export default function Account() {
  const r = useRouter();
  return <div className="card"><h3>Conta e privacidade</h3>
    <div className="row">
      <a className="btn ghost" href="/api/me/export" download="jornada-meus-dados.json">Exportar meus dados</a>
      <button className="btn ghost" onClick={async () => { await call("POST", "/api/auth/logout"); r.replace("/entrar"); r.refresh(); }}>Sair</button>
      <button className="btn danger" onClick={async () => { if (confirm("Excluir sua conta e todos os seus dados? Isso não pode ser desfeito.")) { await call("DELETE", "/api/me"); r.replace("/entrar"); r.refresh(); } }}>Excluir conta</button></div></div>;
}
