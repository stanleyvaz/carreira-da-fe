"use client";
import { createContext, useCallback, useContext, useState } from "react";

type Kind = "ok" | "error";
type Item = { id: number; kind: Kind; text: string };
type Push = (text: string, kind?: Kind) => void;

const Ctx = createContext<Push | null>(null);
export function useToast(): Push {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast fora do ToastProvider");
  return c;
}

let seq = 0;
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((x) => x.id !== id)), []);
  const push = useCallback<Push>((text, kind = "ok") => {
    const id = ++seq;
    setItems((l) => [...l.slice(-3), { id, kind, text }]);
    setTimeout(() => dismiss(id), kind === "error" ? 9000 : 4500);
  }, [dismiss]);
  return <Ctx.Provider value={push}>{children}
    {/* região sempre montada: leitores de tela anunciam o que entra (erros de forma assertiva) */}
    <div className="adm-toasts" aria-live="polite" aria-atomic="false">
      {items.map((t) => <div key={t.id} className="adm-toast" data-k={t.kind} role={t.kind === "error" ? "alert" : "status"}>
        <span>{t.text}</span><button type="button" aria-label="Fechar aviso" onClick={() => dismiss(t.id)}>✕</button></div>)}
    </div></Ctx.Provider>;
}
