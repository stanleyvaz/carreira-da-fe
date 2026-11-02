"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { call } from "@/lib/client";

export default function AuthForm({ next }: { next?: string }) {
  const r = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(""); setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await call("POST", `/api/auth/${mode}`, mode === "login"
        ? { email: f.get("email"), password: f.get("password") }
        : { email: f.get("email"), password: f.get("password"), displayName: f.get("name") || undefined, acceptTerms: f.get("terms") === "on" });
      r.replace(next ?? "/"); r.refresh();
    } catch (x: any) { setErr(x.message); setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="card fade" aria-label={mode === "login" ? "Entrar" : "Criar conta"}>
      <h2>{mode === "login" ? "Que bom ter você aqui" : "Criar sua conta"}</h2>
      {mode === "register" && <div className="field"><label htmlFor="name">Como quer ser chamado? (opcional)</label><input id="name" name="name" autoComplete="given-name" maxLength={80} /></div>}
      <div className="field"><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" required autoComplete="email" /></div>
      <div className="field"><label htmlFor="password">Senha {mode === "register" && <span className="muted small">(mín. 10 caracteres)</span>}</label>
        <input id="password" name="password" type="password" required minLength={mode === "register" ? 10 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} /></div>
      {mode === "register" && <p className="small"><label style={{ fontWeight: 400 }}><input type="checkbox" name="terms" required style={{ width: "auto", minHeight: 0, marginRight: 8 }} />
        Li e aceito os termos de uso e a política de privacidade. Suas reflexões e anotações são privadas e nunca usadas para publicidade.</label></p>}
      {err && <p role="alert" className="err">{err}</p>}
      <button className="btn" disabled={busy} style={{ width: "100%" }}>{mode === "login" ? "Entrar" : "Criar conta"}</button>
      <p className="small muted" style={{ marginTop: "1rem", textAlign: "center" }}>
        <button type="button" className="chip" onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }}>
          {mode === "login" ? "Ainda não tenho conta" : "Já tenho conta"}</button></p>
    </form>
  );
}
