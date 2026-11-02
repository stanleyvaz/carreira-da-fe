import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getLibraryItem } from "@/lib/services/user";
import { AUDIENCE_LABEL, type Audience } from "@jornada/shared";

/** Leitor do conteúdo guardado no nosso banco. A origem aparece como crédito ("Ver original"). */
export default async function Conteudo({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const parsed = z.string().uuid().safeParse(id); if (!parsed.success) notFound();
  const r: any = await getLibraryItem(id); if (!r) notFound();
  const blocks = String(r.body ?? "").split(/\n{2,}/).filter(Boolean);
  const yt = r.videoUrl ? String(r.videoUrl).replace("www.youtube.com/embed", "www.youtube-nocookie.com/embed") : null;
  return <article className="fade">
    <p className="eyebrow">{r.source}{r.publishedOn ? ` · ${new Date(r.publishedOn + "T12:00:00").toLocaleDateString("pt-BR")}` : ""}</p>
    <h1>{r.title}</h1>
    {r.authorName && <p className="muted small">Por {r.authorName}</p>}
    {r.imageId && /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/api/media/${r.imageId}`} alt="" style={{ width: "100%", borderRadius: 16, margin: ".5rem 0" }} />}
    {yt && <div className="card" style={{ padding: 0, overflow: "hidden" }}><iframe title="Vídeo" src={yt} loading="lazy" sandbox="allow-scripts allow-same-origin allow-presentation" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen style={{ width: "100%", aspectRatio: "16/9", border: 0, display: "block" }} /></div>}
    {r.audioUrl && <audio controls preload="none" src={r.audioUrl} style={{ width: "100%", margin: ".5rem 0" }} />}
    <div className="card">{blocks.map((b, i) => b.startsWith("> ")
      ? <blockquote key={i} style={{ fontFamily: "var(--serif)", margin: "0 0 1rem", paddingLeft: "1rem", borderLeft: "3px solid var(--accent)" }}>{b.replace(/^>\s*/, "")}</blockquote>
      : <p key={i} style={{ whiteSpace: "pre-line" }}>{b}</p>)}
      {blocks.length === 0 && r.blurb && <p>{r.blurb}</p>}</div>
    <p className="small muted">{r.audiences.filter((a: string) => a !== "geral").map((a: string) => AUDIENCE_LABEL[a as Audience]).join(" · ")}</p>
    <p className="small"><a href={r.originalUrl} target="_blank" rel="noopener noreferrer">Ver original em {new URL(r.originalUrl).hostname} ↗</a></p>
  </article>;
}
