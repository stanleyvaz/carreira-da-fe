"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { call } from "@/lib/client";

export default function ForcedPasswordForm({ next }: { next: string }) {
  const r = useRouter(); const [cur, setCur] = useState(""); const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const ok = cur && pw.length >= 10 && pw === pw2;
  return <form className="card" onSubmit={async (e) => {
    e.preventDefault(); if (!ok) return; setBusy(true); setErr("");
    try { await call("POST", "/api/me/password", { currentPassword: cur, newPassword: pw }); r.replace(next); r.refresh(); } catch (x: any) { setErr(x.message); setBusy(false); }
  }}>
    <div className="field"><label htmlFor="fp-cur">Senha temporária</label><input id="fp-cur" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required /></div>
    <div className="field"><label htmlFor="fp-new">Nova senha (mín. 10 caracteres)</label><input id="fp-new" type="password" autoComplete="new-password" minLength={10} value={pw} onChange={(e) => setPw(e.target.value)} required /></div>
    <div className="field"><label htmlFor="fp-new2">Repita a nova senha</label><input id="fp-new2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
      {pw2 && pw !== pw2 && <p className="err">As senhas não conferem.</p>}</div>
    {err && <p className="err" role="alert">{err}</p>}
    <button className="btn" disabled={!ok || busy}>{busy ? "Salvando…" : "Salvar e continuar"}</button>
  </form>;
}
