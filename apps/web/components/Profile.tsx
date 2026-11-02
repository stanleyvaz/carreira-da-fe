"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { call } from "@/lib/client";

/** Reduz a foto no navegador (512 px, JPEG) antes de enviar. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file); const s = Math.min(1, 512 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Imagem inválida"))), "image/jpeg", 0.85));
}
export default function Profile({ name, email, hasAvatar }: { name: string | null; email: string; hasAvatar: boolean }) {
  const r = useRouter(); const [has, setHas] = useState(hasAvatar); const [v, setV] = useState(0);
  const [dn, setDn] = useState(name ?? ""); const [msg, setMsg] = useState(""); const [pw, setPw] = useState({ cur: "", next: "" });
  async function photo(f?: File) {
    if (!f) return;
    try { const blob = await shrink(f); const res = await fetch("/api/me/avatar", { method: "PUT", body: blob, headers: { "content-type": "image/jpeg" } });
      if (!res.ok) throw new Error((await res.json()).error); setHas(true); setV(v + 1); setMsg("Foto atualizada."); r.refresh(); } catch (e: any) { setMsg(e.message); }
  }
  return <div className="card" id="perfil"><h3>Perfil</h3>
    <div className="row" style={{ alignItems: "center" }}>
      {has ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/api/me/avatar-view?v=${v}`} alt="Sua foto" width={72} height={72} style={{ borderRadius: "50%", objectFit: "cover" }} />
        : <div aria-hidden style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--accent-soft)", display: "grid", placeItems: "center", fontSize: 28 }}>{(dn || email)[0]?.toUpperCase()}</div>}
      <div><label className="btn ghost" style={{ cursor: "pointer" }}>Trocar foto<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => photo(e.target.files?.[0])} /></label>
        {has && <button className="chip" onClick={async () => { await call("DELETE", "/api/me/avatar"); setHas(false); r.refresh(); }}>Remover</button>}</div></div>
    <div className="field"><label htmlFor="dn">Nome</label><input id="dn" value={dn} maxLength={80} onChange={(e) => setDn(e.target.value)} />
      <button className="btn ghost" onClick={async () => { try { await call("PUT", "/api/me/profile", { displayName: dn }); setMsg("Nome salvo."); r.refresh(); } catch (e: any) { setMsg(e.message); } }}>Salvar nome</button></div>
    <p className="small muted">E-mail: {email}</p>
    <details><summary>Trocar senha</summary>
      <div className="field"><label htmlFor="pc">Senha atual</label><input id="pc" type="password" autoComplete="current-password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} /></div>
      <div className="field"><label htmlFor="pn">Nova senha (mín. 10 caracteres)</label><input id="pn" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></div>
      <button className="btn" onClick={async () => { try { await call("POST", "/api/me/password", { currentPassword: pw.cur, newPassword: pw.next }); setPw({ cur: "", next: "" }); setMsg("Senha alterada. Outros dispositivos foram desconectados."); } catch (e: any) { setMsg(e.message); } }}>Alterar senha</button></details>
    <p role="status" className="small">{msg}</p></div>;
}
