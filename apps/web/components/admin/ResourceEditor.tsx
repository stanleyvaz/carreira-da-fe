"use client";
import { useState } from "react";
import { call } from "@/lib/client";
import { AUDIENCES, AUDIENCE_LABEL, RESOURCE_KINDS } from "@jornada/shared";
const KIND: Record<string, string> = { article: "Artigo", podcast_episode: "Episódio de podcast", podcast_program: "Programa de podcast", blog: "Blog", site: "Site", video: "Vídeo" };
type F = { kind: string; source: string; title: string; url: string; blurb: string; publishedOn: string; audiences: string[]; topicIds: string[]; body: string; authorName: string; audioUrl: string; videoUrl: string; imageMediaId: string | null };
const EMPTY: F = { kind: "article", source: "", title: "", url: "https://www.universal.org/", blurb: "", publishedOn: "", audiences: [], topicIds: [], body: "", authorName: "", audioUrl: "", videoUrl: "", imageMediaId: null };
/** Formulário de indicação externa. Sem id = criação; com id = edição (somente rascunho). */
export default function ResourceEditor({ id, topics, onSaved, onClose }: { id?: string; topics: { id: string; name: string }[]; onSaved: () => void; onClose: () => void }) {
  const [f, setF] = useState<F | null>(id ? null : EMPTY); const [msg, setMsg] = useState("");
  if (!f) { void call("GET", `/api/admin/content/resource/${id}`).then((r: any) => setF({ kind: r.kind, source: r.source, title: r.title, url: r.url, blurb: r.blurb ?? "", publishedOn: r.publishedOn?.slice(0, 10) ?? "", audiences: r.audiences, topicIds: r.topics.map((t: any) => t.id), body: r.body ?? "", authorName: r.authorName ?? "", audioUrl: r.audioUrl ?? "", videoUrl: r.videoUrl ?? "", imageMediaId: r.imageMediaId })); return <p className="small">Carregando…</p>; }
  const set = (p: Partial<F>) => setF({ ...f, ...p });
  const toggle = (k: "audiences" | "topicIds", v: string) => set({ [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] } as any);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const data = { ...f, blurb: f!.blurb || null, publishedOn: f!.publishedOn || null, body: f!.body || null, authorName: f!.authorName || null, audioUrl: f!.audioUrl || null, videoUrl: f!.videoUrl || null };
    try { if (id) await call("PUT", `/api/admin/content/resource/${id}`, data); else await call("POST", "/api/admin/content", { type: "resource", data }); onSaved(); onClose(); } catch (x: any) { setMsg(x.message); }
  }
  return <form onSubmit={save} className="card" style={{ marginTop: ".5rem" }}>
    <p className="small muted">O texto fica no nosso banco e pode ser editado livremente. O link abaixo é o crédito da fonte original (“Ver original”).</p>
    <div className="grid2">
      <div className="field"><label>Título (como na fonte)</label><input value={f.title} onChange={(e) => set({ title: e.target.value })} required minLength={3} /></div>
      <div className="field"><label>Fonte</label><input value={f.source} onChange={(e) => set({ source: e.target.value })} required placeholder="Blog do Renato Cardoso" /></div>
      <div className="field"><label>Link (universal.org, https)</label><input value={f.url} onChange={(e) => set({ url: e.target.value })} required type="url" /></div>
      <div className="field"><label>Tipo</label><select value={f.kind} onChange={(e) => set({ kind: e.target.value })}>{RESOURCE_KINDS.map((k) => <option key={k} value={k}>{KIND[k]}</option>)}</select></div>
      <div className="field"><label>Data de publicação (opcional)</label><input type="date" value={f.publishedOn} onChange={(e) => set({ publishedOn: e.target.value })} /></div>
    </div>
    <div className="field"><label>Texto do conteúdo (linha em branco separa parágrafos; comece com &gt; para citação)</label><textarea rows={10} value={f.body} maxLength={60000} onChange={(e) => set({ body: e.target.value })} /></div>
    <div className="grid2">
      <div className="field"><label>Autor</label><input value={f.authorName} onChange={(e) => set({ authorName: e.target.value })} /></div>
      <div className="field"><label>Link do áudio (https, opcional)</label><input type="url" value={f.audioUrl} onChange={(e) => set({ audioUrl: e.target.value })} /></div>
      <div className="field"><label>Link do vídeo para incorporar (https, opcional)</label><input type="url" value={f.videoUrl} onChange={(e) => set({ videoUrl: e.target.value })} /></div>
      <div className="field"><label>Imagem de capa (JPEG/PNG/WebP, até 3 MB)</label>
        {f.imageMediaId && /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/api/media/${f.imageMediaId}`} alt="" style={{ maxWidth: 160, borderRadius: 8, display: "block", marginBottom: 4 }} />}
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return;
          try { const res = await fetch("/api/admin/media", { method: "POST", body: file }); const j = await res.json(); if (!res.ok) throw new Error(j.error); set({ imageMediaId: j.id }); } catch (x: any) { setMsg(x.message); } }} />
        {f.imageMediaId && <button type="button" className="chip" onClick={() => set({ imageMediaId: null })}>Remover imagem</button>}</div>
    </div>
    <div className="field"><label>Descrição curta (nossas palavras, até 240)</label><textarea value={f.blurb} maxLength={240} onChange={(e) => set({ blurb: e.target.value })} /></div>
    <p className="small muted" style={{ margin: ".5rem 0 .25rem" }}>Público</p>
    <div className="chips">{AUDIENCES.map((a) => <button type="button" key={a} className="chip" aria-pressed={f.audiences.includes(a)} onClick={() => toggle("audiences", a)}>{AUDIENCE_LABEL[a]}</button>)}</div>
    <p className="small muted" style={{ margin: ".5rem 0 .25rem" }}>Temas (confirme)</p>
    <div className="chips">{topics.map((t) => <button type="button" key={t.id} className="chip" aria-pressed={f.topicIds.includes(t.id)} onClick={() => toggle("topicIds", t.id)}>{t.name}</button>)}</div>
    <div className="row" style={{ marginTop: ".5rem" }}><button className="btn">Salvar</button><button type="button" className="chip" onClick={onClose}>Fechar</button><span className="small">{msg}</span></div>
  </form>;
}
