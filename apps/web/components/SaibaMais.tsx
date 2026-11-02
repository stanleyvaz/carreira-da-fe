import { AUDIENCE_LABEL, type Audience } from "@jornada/shared";
const KIND: Record<string, string> = { article: "Ler", podcast_episode: "Ouvir", podcast_program: "Ouvir", blog: "Ler", site: "Visitar", video: "Assistir" };
type R = { hasContent?: boolean; imageId?: string | null; id: string; kind: string; source: string; title: string; url: string; blurb?: string | null; audiences: string[] };
/** Indicações externas: sempre voluntárias, abrem no site de origem (nova aba). */
export default function SaibaMais({ items, title = "Quer saber mais?" }: { items: R[]; title?: string }) {
  if (!items.length) return null;
  return <section aria-label={title}><div className="sectionh"><h2>{title}</h2></div>
    {items.map((r) => <a key={r.id} className="card link" href={r.hasContent ? `/conteudo/${r.id}` : r.url} {...(r.hasContent ? {} : { target: "_blank", rel: "noopener noreferrer" })}>
      <span className="small muted">{KIND[r.kind] ?? "Ver"} · {r.source}{r.audiences.filter((a) => a !== "geral").length ? ` · ${r.audiences.filter((a) => a !== "geral").map((a) => AUDIENCE_LABEL[a as Audience]).join(", ")}` : ""}</span>
      <h3 style={{ margin: ".15rem 0" }}>{r.title}</h3>{r.blurb && <p className="muted small" style={{ margin: 0 }}>{r.blurb}</p>}
      <span className="small">{r.hasContent ? "Ler no app →" : "Abre no site de origem ↗"}</span></a>)}
  </section>;
}
