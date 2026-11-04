import { STATUS_LABEL } from "@/lib/adminLabels";

// Glifo + texto: o estado não depende só da cor (WCAG 1.4.1).
const GLYPH: Record<string, string> = { draft: "✎", in_review: "◔", approved: "✓", published: "●", archived: "▣" };
export default function StatusBadge({ status }: { status: string }) {
  return <span className="sbadge" data-s={status}><i aria-hidden="true">{GLYPH[status] ?? "•"}</i>{STATUS_LABEL[status] ?? status}</span>;
}
