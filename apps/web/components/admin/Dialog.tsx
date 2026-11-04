"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type Opts = { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean; label?: string; placeholder?: string };
type Req = { mode: "confirm" | "prompt"; message: string; opts: Opts; resolve: (v: boolean | string | null) => void };
type Api = { confirm: (message: string, opts?: Opts) => Promise<boolean>; prompt: (message: string, opts?: Opts) => Promise<string | null> };

const Ctx = createContext<Api | null>(null);
export function useDialog(): Api {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDialog fora do DialogProvider");
  return c;
}

/** Diálogos acessíveis (<dialog> nativo: foco preso, Esc fecha) no lugar de window.confirm/prompt. */
export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [req, setReq] = useState<Req | null>(null);
  const [value, setValue] = useState("");
  const ref = useRef<HTMLDialogElement>(null);

  const ask = useCallback((mode: Req["mode"], message: string, opts: Opts) =>
    new Promise<boolean | string | null>((resolve) => { setValue(""); setReq({ mode, message, opts, resolve }); }), []);
  const api = useMemo<Api>(() => ({
    confirm: async (m, o = {}) => (await ask("confirm", m, o)) === true,
    prompt: async (m, o = {}) => (await ask("prompt", m, o)) as string | null,
  }), [ask]);

  useEffect(() => {
    const d = ref.current;
    if (req && d && !d.open) d.showModal();
  }, [req]);

  function finish(v: boolean | string | null) {
    if (!req) return;
    req.resolve(v); setReq(null); ref.current?.close();
  }
  const cancelValue = req?.mode === "prompt" ? null : false;

  return <Ctx.Provider value={api}>{children}
    <dialog ref={ref} className="adm-dialog" aria-labelledby="adm-dlg-title" onCancel={(e) => { e.preventDefault(); finish(cancelValue); }}>
      {req && <form onSubmit={(e) => { e.preventDefault(); finish(req.mode === "prompt" ? value.trim() : true); }}>
        <h2 id="adm-dlg-title">{req.opts.title ?? (req.mode === "prompt" ? "Informar" : "Confirmar")}</h2>
        <p>{req.message}</p>
        {req.mode === "prompt" && <div className="field" style={{ margin: 0 }}>
          <label htmlFor="adm-dlg-input">{req.opts.label ?? "Comentário"}</label>
          <textarea id="adm-dlg-input" autoFocus rows={3} value={value} placeholder={req.opts.placeholder} onChange={(e) => setValue(e.target.value)} /></div>}
        <div className="dlgactions">
          <button type="button" className="btn ghost" onClick={() => finish(cancelValue)}>{req.opts.cancelLabel ?? "Cancelar"}</button>
          <button type="submit" className={`btn${req.opts.danger ? " danger" : ""}`} autoFocus={req.mode === "confirm"}>{req.opts.confirmLabel ?? "Confirmar"}</button>
        </div>
      </form>}
    </dialog></Ctx.Provider>;
}
