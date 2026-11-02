import type { ContentStatus } from "@jornada/shared";
export const STATUS_LABEL: Record<string, string> = { draft: "Rascunho", in_review: "Em revisão", approved: "Aprovado", published: "Publicado", archived: "Arquivado" };
export const ACTION_LABEL: Record<string, string> = { in_review: "Enviar para revisão", approved: "Aprovar", published: "Publicar", archived: "Arquivar", draft: "Devolver a rascunho" };
export const ORDER: ContentStatus[] = ["in_review", "approved", "published", "archived", "draft"];
export const SECTIONS = {
  jornadas: { type: "journey", kind: "journey", label: "Jornadas", singular: "jornada" },
  desafios: { type: "journey", kind: "challenge", label: "Desafios", singular: "desafio" },
  reflexoes: { type: "reflection", label: "Reflexões diárias", singular: "reflexão" },
  exercicios: { type: "activity", label: "Exercícios (aba Exercitar)", singular: "exercício" },
  musicas: { type: "song", label: "Músicas", singular: "música" },
  indicacoes: { type: "resource", label: "Biblioteca (artigos, podcasts, links)", singular: "conteúdo" },
} as const;
export type SectionKey = keyof typeof SECTIONS;
