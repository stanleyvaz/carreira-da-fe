"use client";
import { useCallback, useEffect, useState } from "react";
import { call } from "@/lib/client";
import PageHead from "./PageHead";
import { useDialog } from "./Dialog";
import { useToast } from "./Toast";

const CATS: [string, string, string][] = [
  ["greeting_morning", "Saudação da manhã", "Ao abrir o app antes do meio-dia, se a reflexão de hoje ainda não foi feita."],
  ["greeting_afternoon", "Saudação da tarde", "Entre meio-dia e 18h, se a reflexão de hoje ainda não foi feita."],
  ["greeting_evening", "Saudação da noite", "Depois das 18h, se a reflexão de hoje ainda não foi feita."],
  ["greeting_done", "Saudação com o dia cumprido", "Quando a reflexão de hoje já foi feita."],
  ["greeting_default", "Saudação geral", "Nas demais telas."],
  ["poke", "Ao tocar na ovelhinha", "Uma frase sorteada a cada toque."],
  ["thanks", "Ao concluir algo", "Depois de concluir uma reflexão, etapa ou prática."],
  ["idle", "Passeio", "Sorteada a cada 24 segundos enquanto a tela está aberta."],
];

export function CompanionPanel({ role }: { role: string }) {
  const toast = useToast(); const dialog = useDialog();
  const [rows, setRows] = useState<any[]>([]); const [edits, setEdits] = useState<Record<string, string>>({}); const [newText, setNewText] = useState<Record<string, string>>({});
  const canWrite = ["admin", "editor", "publisher"].includes(role); const canPublish = role === "admin" || role === "publisher";
  const load = useCallback(async () => { try { setRows(await call("GET", "/api/admin/companion")); setEdits({}); } catch (e: any) { toast(e.message, "error"); } }, [toast]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  const act = async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); await load(); } catch (e: any) { toast(e.message, "error"); } };

  return <div>
    <PageHead title="Frases da ovelhinha" description={<>O que a personagem diz no app. Use <code>{"{nome}"}</code> para chamar a pessoa pelo nome (some, com a vírgula, quando não houver nome). Frases novas nascem desligadas; administradores e publicadores habilitam. O app atualiza as frases ao abrir.</>} />
    {CATS.map(([cat, label, help]) => {
      const list = rows.filter((r) => r.category === cat); const on = list.filter((r) => r.enabled).length;
      return <section key={cat} className="card" aria-labelledby={`h-${cat}`}>
        <h3 id={`h-${cat}`}>{label} <span className="small muted">· {on} habilitada(s)</span></h3><p className="hint" style={{ marginTop: 0 }}>{help}{on === 0 && " Sem frases habilitadas, o app usa as frases padrão."}</p>
        {list.map((r) => {
          const val = edits[r.id] ?? r.text; const dirty = val !== r.text; const locked = !canWrite || (r.enabled && !canPublish);
          return <div key={r.id} className="phrase">
            <input type="text" aria-label={`Frase: ${r.text}`} value={val} maxLength={140} disabled={locked} onChange={(e) => setEdits({ ...edits, [r.id]: e.target.value })} />
            <div className="row" style={{ flexWrap: "nowrap" }}>
              {dirty && <button className="chip" onClick={() => act(() => call("PATCH", `/api/admin/companion/${r.id}`, { text: val }), "Frase salva.")}>Salvar</button>}
              {canPublish
                ? <label className="small" style={{ display: "inline-flex", gap: ".35rem", alignItems: "center", whiteSpace: "nowrap" }}>
                    <input type="checkbox" checked={r.enabled} onChange={(e) => act(() => call("PATCH", `/api/admin/companion/${r.id}`, { enabled: e.target.checked }), e.target.checked ? "Frase habilitada." : "Frase desligada.")} /> Habilitada</label>
                : <span className="small muted">{r.enabled ? "Habilitada" : "Desligada"}</span>}
              {canPublish && <button className="chip danger" aria-label={`Excluir a frase ${r.text}`} onClick={async () => {
                if (await dialog.confirm(`“${r.text}” será excluída.`, { title: "Excluir frase", confirmLabel: "Excluir", danger: true })) void act(() => call("DELETE", `/api/admin/companion/${r.id}`), "Frase excluída.");
              }}>Excluir</button>}
            </div>
          </div>;
        })}
        {canWrite && <form className="row" style={{ marginTop: ".6rem" }} onSubmit={(e) => {
          e.preventDefault(); const t = (newText[cat] ?? "").trim(); if (t.length < 2) return;
          void act(async () => { await call("POST", "/api/admin/companion", { category: cat, text: t }); setNewText({ ...newText, [cat]: "" }); }, canPublish ? "Frase criada (desligada). Habilite quando quiser." : "Frase criada. Um publicador precisa habilitá-la.");
        }}>
          <input aria-label={`Nova frase: ${label}`} placeholder="Nova frase" maxLength={140} value={newText[cat] ?? ""} onChange={(e) => setNewText({ ...newText, [cat]: e.target.value })} style={{ flex: 1 }} />
          <button className="btn ghost" disabled={(newText[cat] ?? "").trim().length < 2}>Adicionar</button></form>}
      </section>;
    })}
  </div>;
}
