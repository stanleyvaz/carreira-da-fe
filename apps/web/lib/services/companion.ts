import { z } from "zod";
import { COMPANIONS, companionSchema, type Role } from "@jornada/shared";
import { one, q } from "../db";
import { HttpError, forbidden, notFound } from "../errors";
import { audit } from "./audit";

/** Frases do personagem (ovelha, leão, pomba, águia, jumentinho). Cada frase vale para todos (animal NULL) ou só para um. Editor cria e ajusta frases desligadas; administrador e publicador ligam, desligam e excluem. */
type Actor = { id: string; role: Role };
export const PHRASE_CATEGORIES = ["greeting_morning", "greeting_afternoon", "greeting_evening", "greeting_done", "greeting_default", "poke", "thanks", "idle"] as const;
const canWrite = (a: Actor) => ["admin", "editor", "publisher"].includes(a.role);
const canPublish = (a: Actor) => ["admin", "publisher"].includes(a.role);

const text = z.string().trim().min(2, "Escreva ao menos 2 caracteres").max(140, "Use no máximo 140 caracteres");

/** Para o app: só as habilitadas, agrupadas por categoria. Com `animal`, junta as gerais e as daquele animal; sem, só as gerais. */
export async function enabledPhrases(animal?: string | null) {
  const parsed = companionSchema.safeParse(animal);
  const a = parsed.success ? parsed.data : null; // valor desconhecido = só as gerais
  const rows = await q<{ category: string; text: string }>(
    "SELECT category, text FROM companion_phrases WHERE enabled AND (animal IS NULL OR animal = $1) ORDER BY category, sort_order, created_at", [a]);
  const out: Record<string, string[]> = Object.fromEntries(PHRASE_CATEGORIES.map((c) => [c, []]));
  for (const r of rows) out[r.category].push(r.text);
  return out;
}

export async function listPhrases(a: Actor) {
  if (!canWrite(a) && a.role !== "reviewer") throw forbidden();
  return q(`SELECT id, category, text, animal, enabled, sort_order AS "sortOrder", updated_at AS "updatedAt" FROM companion_phrases
            ORDER BY array_position($1::text[], category), array_position($2::text[], animal) NULLS FIRST, sort_order, created_at`,
    [PHRASE_CATEGORIES as unknown as string[], COMPANIONS as unknown as string[]]);
}

const animal = companionSchema.nullish();
const createSchema = z.object({ category: z.enum(PHRASE_CATEGORIES), text, animal, enabled: z.boolean().default(false), sortOrder: z.number().int().min(0).max(999).optional() });
export async function createPhrase(a: Actor, input: z.input<typeof createSchema>) {
  if (!canWrite(a)) throw forbidden();
  const d = createSchema.parse(input);
  if (d.enabled && !canPublish(a)) throw new HttpError(403, "Só administradores e publicadores habilitam frases.");
  const r = await one<{ id: string }>(`INSERT INTO companion_phrases(category, text, enabled, sort_order, updated_by, animal)
      VALUES ($1,$2,$3,coalesce($4,(SELECT coalesce(max(sort_order),0)+1 FROM companion_phrases WHERE category=$1)),$5,$6) RETURNING id`,
    [d.category, d.text, d.enabled, d.sortOrder ?? null, a.id, d.animal ?? null]);
  await audit(a.id, "companion_phrase.create", "companion_phrase", r!.id);
  return r;
}

const updateSchema = z.object({ text: text.optional(), animal, category: z.enum(PHRASE_CATEGORIES).optional(), enabled: z.boolean().optional(), sortOrder: z.number().int().min(0).max(999).optional() });
export async function updatePhrase(a: Actor, id: string, input: z.input<typeof updateSchema>) {
  if (!canWrite(a)) throw forbidden();
  const d = updateSchema.parse(input);
  const cur = await one<{ enabled: boolean }>("SELECT enabled FROM companion_phrases WHERE id=$1", [z.string().uuid().parse(id)]);
  if (!cur) throw notFound();
  if (!canPublish(a) && (cur.enabled || d.enabled !== undefined))
    throw new HttpError(403, "Frases habilitadas e a habilitação ficam com administradores e publicadores.");
  // animal: undefined = mantém; null = vale para todos; valor = só aquele animal.
  await q(`UPDATE companion_phrases SET text=coalesce($2,text), category=coalesce($3,category), enabled=coalesce($4,enabled),
            sort_order=coalesce($5,sort_order), updated_by=$6, updated_at=now(), animal=CASE WHEN $7 THEN $8 ELSE animal END WHERE id=$1`,
    [id, d.text ?? null, d.category ?? null, d.enabled ?? null, d.sortOrder ?? null, a.id, d.animal !== undefined, d.animal ?? null]);
  await audit(a.id, d.enabled === true ? "companion_phrase.enable" : d.enabled === false ? "companion_phrase.disable" : "companion_phrase.update", "companion_phrase", id);
}

export async function deletePhrase(a: Actor, id: string) {
  if (!canPublish(a)) throw forbidden();
  const r = await q("DELETE FROM companion_phrases WHERE id=$1 RETURNING id", [z.string().uuid().parse(id)]);
  if (!r.length) throw notFound();
  await audit(a.id, "companion_phrase.delete", "companion_phrase", id);
}
