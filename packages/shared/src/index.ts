import { z } from "zod";

export const ROLES = ["user", "admin", "editor", "reviewer", "publisher", "analyst"] as const;
export type Role = (typeof ROLES)[number];
export const CONTENT_STATUS = ["draft", "in_review", "approved", "published", "archived"] as const;
export type ContentStatus = (typeof CONTENT_STATUS)[number];
export type ContentType = "journey" | "reflection" | "activity" | "song" | "resource";

// Transições editoriais permitidas e papéis autorizados a executá-las.
export const TRANSITIONS: Record<string, { to: ContentStatus; roles: Role[] }[]> = {
  draft: [{ to: "in_review", roles: ["admin", "editor"] }],
  in_review: [
    { to: "approved", roles: ["admin", "reviewer"] },
    { to: "draft", roles: ["admin", "reviewer"] },
  ],
  approved: [{ to: "published", roles: ["admin", "publisher"] }, { to: "draft", roles: ["admin", "editor"] }],
  published: [{ to: "archived", roles: ["admin", "publisher"] }],
  archived: [{ to: "draft", roles: ["admin", "editor"] }],
};
export function canTransition(from: ContentStatus, to: ContentStatus, role: Role) {
  return (TRANSITIONS[from] ?? []).some((t) => t.to === to && t.roles.includes(role));
}
export const ADMIN_ROLES: Role[] = ["admin", "editor", "reviewer", "publisher", "analyst"];

export const passwordSchema = z.string().min(10, "Use ao menos 10 caracteres").max(200);
export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10, "Use ao menos 10 caracteres").max(200),
});
export const registerSchema = credentialsSchema.extend({
  displayName: z.string().trim().max(80).optional(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "É necessário aceitar os termos" }) }),
});
/** Personagem do app (animais bíblicos). A ordem é a da tela de escolha. */
export const COMPANIONS = ["sheep", "lion", "dove", "eagle", "donkey"] as const;
export type Companion = (typeof COMPANIONS)[number];
export const COMPANION_LABELS: Record<Companion, string> = { sheep: "Ovelha", lion: "Leão", dove: "Pomba", eagle: "Águia", donkey: "Jumentinho" };
export const companionSchema = z.enum(COMPANIONS);

export const preferencesSchema = z.object({
  goal: z.string().trim().max(200).nullish(),
  topicSlugs: z.array(z.string().max(60)).max(15).default([]),
  mode: z.enum(["read", "listen"]).default("read"),
  dailyMinutes: z.union([z.literal(1), z.literal(3), z.literal(5), z.literal(10)]).default(3),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  anchor: z.string().trim().max(60).nullish(), // "depois do café": quando/onde o hábito acontece
  companion: companionSchema.nullish(), // ausente = mantém a escolha atual
});
export const noteSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  refKind: z.enum(["reflection", "step", "activity"]).nullish(),
  refId: z.string().uuid().nullish(),
});
export const stepProgressSchema = z.object({ answerIndex: z.number().int().min(0).max(10).nullish() });
export const journeyInputSchema = z.object({
  topicId: z.string().uuid(),
  title: z.string().trim().min(3).max(140),
  summary: z.string().trim().max(500).nullish(),
  days: z.number().int().min(3).max(40),
  kind: z.enum(["journey", "challenge"]).default("journey"),
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
});
export const promoteSchema = z.object({
  headline: z.string().trim().min(3).max(120),
  until: z.string().datetime().nullish(),
});
export const reflectionInputSchema = z.object({
  topicId: z.string().uuid().nullish(),
  publishDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  passageId: z.string().uuid().nullish(),
  title: z.string().trim().min(3).max(140),
  body: z.string().trim().min(10).max(4000),
  application: z.string().trim().max(1000).nullish(),
  question: z.string().trim().max(500).nullish(),
});
export const transitionSchema = z.object({
  to: z.enum(CONTENT_STATUS),
  comment: z.string().trim().max(1000).nullish(),
});

// Recomendação determinística: só preferências declaradas e histórico próprio.
// Nunca infere condição espiritual.
export function rankJourneys<T extends { id: string; topicSlug: string; days: number }>(
  journeys: T[],
  prefs: { topicSlugs: string[]; dailyMinutes: number },
  completedJourneyIds: Set<string>,
  startedJourneyIds: Set<string>,
): T[] {
  const score = (j: T) =>
    (startedJourneyIds.has(j.id) ? 100 : 0) +
    (prefs.topicSlugs.includes(j.topicSlug) ? 10 : 0) +
    (prefs.dailyMinutes <= 3 && j.days <= 5 ? 2 : 0) -
    (completedJourneyIds.has(j.id) ? 1000 : 0);
  return [...journeys].sort((a, b) => score(b) - score(a));
}

// Evita reidentificação em grupos pequenos nos indicadores agregados.
export const MIN_GROUP_SIZE = 5;
export function suppressSmall(n: number): number | null {
  return n < MIN_GROUP_SIZE ? null : n;
}

// Contrato para integração futura de IA (RAG sobre acervo aprovado). Não implementado no MVP.
export interface BibleAssistant {
  answer(q: { question: string; userId: string }): Promise<{
    answer: string;
    citations: { passageId?: string; contentType?: ContentType; contentId?: string }[];
    insufficientBasis: boolean;
  }>;
}

export const AUDIENCES = ["homens", "mulheres", "criancas", "jovens", "familia", "casais", "geral"] as const;
export type Audience = (typeof AUDIENCES)[number];
export const AUDIENCE_LABEL: Record<Audience, string> = { homens: "Homens", mulheres: "Mulheres", criancas: "Crianças", jovens: "Jovens", familia: "Família", casais: "Casais", geral: "Para todos" };
export const RESOURCE_KINDS = ["article", "podcast_episode", "podcast_program", "blog", "site", "video"] as const;
