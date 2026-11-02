"use client";
import { useState } from "react";
import { call } from "@/lib/client";
type S = { enabled: boolean; readingReminder: boolean; nudge: boolean; newContent: boolean; reminderTime: string | null; quietStart: string; quietEnd: string; maxPerWeek: number };
export default function Reminders({ initial }: { initial: S }) {
  const [s, setS] = useState<S>(initial); const [msg, setMsg] = useState("");
  const set = (p: Partial<S>) => setS({ ...s, ...p });
  const tog = (k: "enabled" | "readingReminder" | "nudge" | "newContent", label: string, hint?: string) =>
    <label className="row" style={{ alignItems: "flex-start", gap: ".6rem" }}><input type="checkbox" style={{ width: "auto", minHeight: 0, marginTop: ".3rem" }} checked={s[k]} onChange={(e) => set({ [k]: e.target.checked } as any)} /><span>{label}{hint && <><br /><span className="small muted">{hint}</span></>}</span></label>;
  return <div className="card"><h3>Lembretes e notificações</h3>
    <p className="small muted">Tudo opcional e no seu ritmo. Os avisos no aparelho funcionam no app para iPhone; aqui na web ficam suas preferências e a caixa de novidades.</p>
    {tog("enabled", "Receber notificações")}
    {s.enabled && <>
      {tog("readingReminder", "Lembrar a hora da Palavra")}
      {s.readingReminder && <div className="field"><label htmlFor="rt">Horário</label><input id="rt" type="time" value={s.reminderTime ?? "07:30"} onChange={(e) => set({ reminderTime: e.target.value })} /></div>}
      {tog("nudge", "Um lembrete gentil no fim do dia se eu ainda não fiz a reflexão", "Sem cobrança: uma mensagem curta, só se o dia ainda estiver em aberto.")}
      {tog("newContent", "Avisar sobre novos conteúdos", `No máximo ${s.maxPerWeek} avisos por semana, fora do horário de silêncio (${s.quietStart}–${s.quietEnd}).`)}
      <div className="field"><label htmlFor="mx">Máximo de avisos por semana</label><select id="mx" value={s.maxPerWeek} onChange={(e) => set({ maxPerWeek: Number(e.target.value) })}>{[0, 1, 2, 3, 5, 7].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
    </>}
    <button className="btn" onClick={async () => { try { await call("PUT", "/api/me/notifications", { ...s, reminderTime: s.readingReminder ? s.reminderTime ?? "07:30" : s.reminderTime }); setMsg("Preferências salvas."); } catch (e: any) { setMsg(e.message); } }}>Salvar</button>
    <p role="status" className="small">{msg}</p></div>;
}
