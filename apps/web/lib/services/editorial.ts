import { z } from "zod";
import { AUDIENCES, RESOURCE_KINDS, ROLES, canTransition, journeyInputSchema, promoteSchema, reflectionInputSchema, suppressSmall, transitionSchema,
  type ContentStatus, type ContentType, type Role } from "@jornada/shared";
import { one, q, tx } from "../db";
import { HttpError, forbidden, notFound } from "../errors";
import { audit } from "./audit";
import { lookupRef } from "./bible";

type Actor = { id: string; role: Role };
const TABLE: Record<ContentType, string> = { journey: "learning_journeys", reflection: "reflections", activity: "practical_activities", song: "songs", resource: "resources" };

export const stepsSchema = z.array(z.object({
  title: z.string().trim().min(2).max(140),
  passageId: z.string().uuid().nullish(),
  passage: z.string().trim().max(80).nullish(), // "Livro 3:16-18" (resolvida na ACF)
  context: z.string().trim().max(3000).nullish(),
  explanation: z.string().trim().max(5000).nullish(),
  application: z.string().trim().max(2000).nullish(),
  extra: z.string().trim().max(5000).nullish(),
  question: z.object({
    prompt: z.string().trim().min(3).max(300),
    options: z.array(z.string().trim().min(1).max(200)).min(2).max(6),
    correctIndex: z.number().int().min(0),
    explanation: z.string().trim().max(1000).nullish(),
  }).refine((x) => x.correctIndex < x.options.length, "Gabarito fora das opções").nullish(),
})).max(14);

async function load(type: ContentType, id: string) {
  const row = await one<any>(`SELECT * FROM ${TABLE[type]} WHERE id=$1`, [id]);
  if (!row) throw notFound();
  return row;
}
function assertEditor(a: Actor) {
  if (!["admin", "editor"].includes(a.role)) throw forbidden();
}

export async function createJourney(a: Actor, input: z.input<typeof journeyInputSchema>) {
  assertEditor(a);
  const d = journeyInputSchema.parse(input);
  const r = await one<{ id: string }>(
    "INSERT INTO learning_journeys(topic_id,title,summary,days,author_id,kind,starts_at,ends_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
    [d.topicId, d.title, d.summary ?? null, d.days, a.id, d.kind, d.startsAt ?? null, d.endsAt ?? null]);
  await audit(a.id, "journey.create", "journey", r!.id);
  return r!.id;
}
export async function createReflection(a: Actor, input: z.input<typeof reflectionInputSchema>) {
  assertEditor(a);
  const d = reflectionInputSchema.parse(input);
  const r = await one<{ id: string }>(
    `INSERT INTO reflections(topic_id,publish_date,passage_id,title,body,application,question,author_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [d.topicId ?? null, d.publishDate ?? null, d.passageId ?? null, d.title, d.body, d.application ?? null, d.question ?? null, a.id]);
  await audit(a.id, "reflection.create", "reflection", r!.id);
  return r!.id;
}
export async function getSong(a: Actor, id: string) {
  const s = await load("song", id);
  const topics = await q("SELECT t.id,t.name,st.suggested FROM song_topics st JOIN topics t ON t.id=st.topic_id WHERE st.song_id=$1", [id]);
  return { id: s.id, title: s.title, lyrics: s.lyrics, credits: s.credits, status: s.status, topics };
}
export async function setSongCredits(a: Actor, songId: string, credits: string) {
  assertEditor(a);
  const c = z.string().trim().min(3).max(500).parse(credits);
  const s = await load("song", songId);
  if (s.status !== "draft") throw new HttpError(409, "Somente rascunhos podem ser editados");
  await q("UPDATE songs SET credits=$2, updated_at=now() WHERE id=$1", [songId, c]);
  await audit(a.id, "song.credits.update", "song", songId);
}

/** Confirma/ajusta os temas de uma música (remove a marca de sugestão automática). Só em rascunho. */
export async function setSongTopics(a: Actor, songId: string, topicIds: string[]) {
  assertEditor(a);
  const ids = z.array(z.string().uuid()).max(5).parse(topicIds);
  const s = await load("song", songId);
  if (s.status !== "draft") throw new HttpError(409, "Somente rascunhos podem ser editados");
  await tx(async (c) => {
    await c.query("DELETE FROM song_topics WHERE song_id=$1", [songId]);
    for (const t of ids) await c.query("INSERT INTO song_topics(song_id,topic_id,suggested) VALUES ($1,$2,false)", [songId, t]);
  });
  await audit(a.id, "song.topics.update", "song", songId, { topics: ids.length });
}

// Indicações externas (Saiba mais): só metadados + link; passam pelo mesmo fluxo editorial.
const resourceSchema = z.object({
  kind: z.enum(RESOURCE_KINDS),
  source: z.string().trim().min(2).max(80),
  title: z.string().trim().min(3).max(200),
  url: z.string().trim().url().max(500).refine((u) => { try { const x = new URL(u); return x.protocol === "https:" && /(^|\.)universal\.org$/.test(x.hostname); } catch { return false; } }, "Use um link https de universal.org"),
  blurb: z.string().trim().max(240).nullish(),
  publishedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  audiences: z.array(z.enum(AUDIENCES)).max(4).default([]),
  body: z.string().max(60000).nullish(),
  authorName: z.string().trim().max(120).nullish(),
  audioUrl: z.string().trim().url().max(500).refine((u) => u.startsWith("https://"), "Use um link https").nullish().or(z.literal("")),
  videoUrl: z.string().trim().url().max(500).refine((u) => u.startsWith("https://"), "Use um link https").nullish().or(z.literal("")),
  imageMediaId: z.string().uuid().nullish(),
  topicIds: z.array(z.string().uuid()).max(5).default([]),
});
export async function createResource(a: Actor, input: z.input<typeof resourceSchema>) {
  assertEditor(a);
  const d = resourceSchema.parse(input);
  const id = await tx(async (c) => {
    const r = await c.query(`INSERT INTO resources(kind,source,title,url,blurb,published_on,audiences,author_id,body,author_name,audio_url,video_url,image_media_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [d.kind, d.source, d.title, d.url, d.blurb ?? null, d.publishedOn ?? null, d.audiences, a.id, d.body || null, d.authorName || null, d.audioUrl || null, d.videoUrl || null, d.imageMediaId ?? null]);
    for (const t of d.topicIds) await c.query("INSERT INTO resource_topics(resource_id,topic_id,suggested) VALUES ($1,$2,false)", [r.rows[0].id, t]);
    return r.rows[0].id as string;
  });
  await audit(a.id, "resource.create", "resource", id);
  return id;
}
export async function getResource(a: Actor, id: string) {
  const r = await load("resource", id);
  const topics = await q("SELECT t.id,t.name,rt.suggested FROM resource_topics rt JOIN topics t ON t.id=rt.topic_id WHERE rt.resource_id=$1", [id]);
  return { id: r.id, kind: r.kind, source: r.source, title: r.title, url: r.url, blurb: r.blurb, publishedOn: r.published_on, audiences: r.audiences, status: r.status, topics,
    body: r.body, authorName: r.author_name, audioUrl: r.audio_url, videoUrl: r.video_url, imageMediaId: r.image_media_id };
}
export async function updateResource(a: Actor, id: string, input: z.input<typeof resourceSchema>) {
  assertEditor(a); await assertDraft("resource", id);
  const d = resourceSchema.parse(input);
  await tx(async (c) => {
    await c.query(`UPDATE resources SET kind=$2,source=$3,title=$4,url=$5,blurb=$6,published_on=$7,audiences=$8,body=$9,author_name=$10,audio_url=$11,video_url=$12,image_media_id=$13,updated_at=now() WHERE id=$1`,
      [id, d.kind, d.source, d.title, d.url, d.blurb ?? null, d.publishedOn ?? null, d.audiences, d.body || null, d.authorName || null, d.audioUrl || null, d.videoUrl || null, d.imageMediaId ?? null]);
    await c.query("DELETE FROM resource_topics WHERE resource_id=$1", [id]);
    for (const t of d.topicIds) await c.query("INSERT INTO resource_topics(resource_id,topic_id,suggested) VALUES ($1,$2,false)", [id, t]);
  });
  await audit(a.id, "resource.update", "resource", id);
}

export async function createActivity(a: Actor, input: { title: string; invitation: string; topicId?: string | null }) {
  assertEditor(a);
  const d = z.object({ title: z.string().trim().min(3).max(140), invitation: z.string().trim().min(5).max(600), topicId: z.string().uuid().nullish() }).parse(input);
  const r = await one<{ id: string }>(
    "INSERT INTO practical_activities(topic_id,title,invitation,author_id) VALUES ($1,$2,$3,$4) RETURNING id", [d.topicId ?? null, d.title, d.invitation, a.id]);
  await audit(a.id, "activity.create", "activity", r!.id);
  return r!.id;
}

/** Substitui os passos de uma jornada em rascunho. */
export async function setJourneySteps(a: Actor, journeyId: string, input: z.input<typeof stepsSchema>) {
  assertEditor(a);
  const steps = stepsSchema.parse(input);
  const j = await load("journey", journeyId);
  if (j.status !== "draft") throw new HttpError(409, "Somente rascunhos podem ser editados");
  const pids: (string | null)[] = [];
  for (const s of steps) pids.push(s.passage ? (await lookupRef("ACF", s.passage)).passageId : s.passageId ?? null);
  await tx(async (c) => {
    await c.query("DELETE FROM journey_steps WHERE journey_id=$1", [journeyId]);
    for (const [i, s] of steps.entries()) {
      const r = await c.query(
        `INSERT INTO journey_steps(journey_id,position,title,passage_id,context,explanation,application,extra)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [journeyId, i + 1, s.title, pids[i], s.context ?? null, s.explanation ?? null, s.application ?? null, s.extra ?? null]);
      if (s.question)
        await c.query(`INSERT INTO comprehension_questions(step_id,prompt,options,correct_index,explanation) VALUES ($1,$2,$3,$4,$5)`,
          [r.rows[0].id, s.question.prompt, s.question.options, s.question.correctIndex, s.question.explanation ?? null]);
    }
    await c.query("UPDATE learning_journeys SET updated_at=now() WHERE id=$1", [journeyId]);
  });
  await audit(a.id, "journey.steps.update", "journey", journeyId, { count: steps.length });
}

async function snapshot(type: ContentType, id: string, version: number, by: string) {
  const row = await load(type, id);
  const data: any = { ...row };
  if (type === "journey")
    data.steps = await q(`SELECT s.*, (SELECT json_agg(cq) FROM comprehension_questions cq WHERE cq.step_id=s.id) AS questions
      FROM journey_steps s WHERE journey_id=$1 ORDER BY position`, [id]);
  await q(`INSERT INTO content_versions(content_type,content_id,version,snapshot,created_by) VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (content_type,content_id,version) DO UPDATE SET snapshot=EXCLUDED.snapshot`, [type, id, version, JSON.stringify(data), by]);
}

export async function transition(a: Actor, type: ContentType, id: string, input: z.input<typeof transitionSchema>) {
  const { to, comment } = transitionSchema.parse(input);
  const row = await load(type, id);
  const from = row.status as ContentStatus;
  if (!canTransition(from, to, a.role)) throw new HttpError(403, `Transição ${from} → ${to} não permitida para este perfil`);

  if (to === "in_review" && type === "journey") {
    const steps = await q<{ n: number; q: number }>(
      `SELECT count(*)::int AS n, count(cq.id)::int AS q FROM journey_steps s LEFT JOIN comprehension_questions cq ON cq.step_id=s.id WHERE s.journey_id=$1`, [id]);
    if (steps[0].n !== row.days) throw new HttpError(422, `A jornada precisa ter exatamente ${row.days} etapas`);
    if (steps[0].q < steps[0].n) throw new HttpError(422, "Todas as etapas precisam de pergunta de compreensão");
  }
  if (to === "in_review" && type === "song") {
    const t = await one<{ n: number }>("SELECT count(*)::int AS n FROM song_topics WHERE song_id=$1 AND NOT suggested", [id]);
    if (!t || t.n < 1) throw new HttpError(422, "Confirme ao menos um tema antes de enviar para revisão");
    if (!row.credits) throw new HttpError(422, "Informe autoria/créditos antes de enviar para revisão");
  }
  if (to === "in_review" && type === "resource") {
    const t = await one<{ n: number }>("SELECT count(*)::int AS n FROM resource_topics WHERE resource_id=$1 AND NOT suggested", [id]);
    if (!t || t.n < 1) throw new HttpError(422, "Confirme ao menos um tema antes de enviar para revisão");
    if (!row.audiences?.length) throw new HttpError(422, "Defina o público (ou 'Para todos') antes de enviar para revisão");
    if (!row.blurb) throw new HttpError(422, "Escreva a descrição curta antes de enviar para revisão");
  }
  if (from === "published" && type === "journey") await q("UPDATE learning_journeys SET featured=false, feature_headline=NULL, feature_until=NULL, starter=false WHERE id=$1", [id]);
  if (to === "approved") {
    // Regra: autor não aprova o próprio conteúdo, exceto administradores (decisão do responsável do projeto); a autoaprovação fica marcada na auditoria.
    if (row.author_id === a.id && a.role !== "admin") throw new HttpError(403, "O autor não pode aprovar o próprio conteúdo");
    await q(`UPDATE ${TABLE[type]} SET status='approved', approved_by=$2, approved_at=now(), updated_at=now() WHERE id=$1`, [id, a.id]);
  } else if (to === "published") {
    // Defesa em profundidade: a regra também é imposta por CHECK no banco.
    if (from !== "approved" || !row.approved_by) throw new HttpError(409, "Conteúdo não aprovado não pode ser publicado");
    await q(`UPDATE ${TABLE[type]} SET status='published', published_at=now(), updated_at=now() WHERE id=$1`, [id]);
  } else if (to === "draft") {
    // Volta para edição: nova versão, aprovação anterior é invalidada.
    await q(`UPDATE ${TABLE[type]} SET status='draft', approved_by=NULL, approved_at=NULL, version=version+1, updated_at=now() WHERE id=$1`, [id]);
  } else {
    await q(`UPDATE ${TABLE[type]} SET status=$2, updated_at=now() WHERE id=$1`, [id, to]);
  }
  if (to === "in_review" || to === "published") await snapshot(type, id, row.version, a.id);
  if (from === "in_review" && (to === "approved" || to === "draft"))
    await q(`INSERT INTO editorial_reviews(content_type,content_id,reviewer_id,decision,comment) VALUES ($1,$2,$3,$4,$5)`,
      [type, id, a.id, to === "approved" ? "approved" : "changes_requested", comment ?? null]);
  await audit(a.id, `${type}.${to}`, type, id, { from, comment: comment ?? undefined, ...(to === "approved" && row.author_id === a.id ? { selfApproved: true } : {}) });
}

export async function listContent(a: Actor, type: ContentType, f: { status?: string; topic?: string; q?: string } = {}) {
  const hasTopic = type !== "song" && type !== "resource";
  const extra = type === "resource" ? ",t.source AS \"topicName\",t.audiences,t.url,array_remove(ARRAY[CASE WHEN t.blurb IS NULL OR t.blurb='' THEN 'descrição curta' END, CASE WHEN cardinality(t.audiences)=0 THEN 'público' END, CASE WHEN NOT EXISTS(SELECT 1 FROM resource_topics rt WHERE rt.resource_id=t.id AND NOT rt.suggested) THEN 'tema' END],NULL) AS missing" : type === "reflection" ? ",t.publish_date::text AS \"publishDate\"" : type === "journey" ? ",t.kind,t.featured,t.starter,t.days,t.starts_at AS \"startsAt\",t.ends_at AS \"endsAt\"" : "";
  return q(`SELECT t.id,t.title,t.status,t.version,t.updated_at AS "updatedAt",t.author_id IS NULL AS imported${extra}${hasTopic ? ",tp.name AS \"topicName\",tp.slug AS \"topicSlug\"" : ""}
    FROM ${TABLE[type]} t ${hasTopic ? "LEFT JOIN topics tp ON tp.id=t.topic_id" : ""}
    WHERE ($1::text IS NULL OR t.status=$1) AND ($2::text IS NULL OR ${hasTopic ? "tp.slug=$2" : "true"}) AND ($3::text IS NULL OR t.title ILIKE '%'||$3||'%')
    ORDER BY CASE t.status WHEN 'in_review' THEN 0 WHEN 'draft' THEN 1 WHEN 'approved' THEN 2 WHEN 'published' THEN 3 ELSE 4 END, ${type === "reflection" ? "t.publish_date NULLS LAST," : ""} t.updated_at DESC LIMIT 1000`,
    [f.status ?? null, f.topic ?? null, f.q ?? null]);
}

/** Registro completo para o editor. */
export async function getContent(a: Actor, type: ContentType, id: string) {
  const row = await load(type, id);
  if (type !== "journey") return row;
  const steps = await q(`SELECT s.id,s.position,s.title,s.context,s.explanation,s.application,s.extra,
      CASE WHEN p.id IS NULL THEN NULL ELSE p.book||' '||p.chapter||':'||p.verse_start||CASE WHEN p.verse_end>p.verse_start THEN '-'||p.verse_end ELSE '' END END AS passage,
      p.text AS "passageText",
      (SELECT json_build_object('prompt',cq.prompt,'options',cq.options,'correctIndex',cq.correct_index,'explanation',cq.explanation) FROM comprehension_questions cq WHERE cq.step_id=s.id LIMIT 1) AS question
    FROM journey_steps s LEFT JOIN bible_passages p ON p.id=s.passage_id WHERE s.journey_id=$1 ORDER BY s.position`, [id]);
  return { ...row, steps };
}

async function assertDraft(type: ContentType, id: string) {
  const row = await load(type, id);
  if (row.status !== "draft") throw new HttpError(409, "Somente rascunhos podem ser editados. Devolva o item a rascunho para editar.");
  return row;
}
export async function updateContent(a: Actor, type: ContentType, id: string, input: any) {
  assertEditor(a); await assertDraft(type, id);
  if (type === "journey") {
    const d = journeyInputSchema.parse(input);
    await q(`UPDATE learning_journeys SET topic_id=$2,title=$3,summary=$4,days=$5,kind=$6,starts_at=$7,ends_at=$8,updated_at=now() WHERE id=$1`,
      [id, d.topicId, d.title, d.summary ?? null, d.days, d.kind, d.startsAt ?? null, d.endsAt ?? null]);
  } else if (type === "reflection") {
    const d = reflectionInputSchema.extend({ passage: z.string().trim().max(80).nullish() }).parse(input);
    const pid = d.passage ? (await lookupRef("ACF", d.passage)).passageId : d.passageId ?? null;
    await q(`UPDATE reflections SET topic_id=$2,publish_date=$3,passage_id=$4,title=$5,body=$6,application=$7,question=$8,updated_at=now() WHERE id=$1`,
      [id, d.topicId ?? null, d.publishDate ?? null, pid, d.title, d.body, d.application ?? null, d.question ?? null]);
  } else if (type === "activity") {
    const d = z.object({ title: z.string().trim().min(3).max(140), invitation: z.string().trim().min(5).max(600), topicId: z.string().uuid().nullish() }).parse(input);
    await q("UPDATE practical_activities SET topic_id=$2,title=$3,invitation=$4,updated_at=now() WHERE id=$1", [id, d.topicId ?? null, d.title, d.invitation]);
  } else throw new HttpError(400, "Tipo não editável aqui");
  await audit(a.id, `${type}.update`, type, id);
}
export async function deleteDraft(a: Actor, type: ContentType, id: string) {
  assertEditor(a); await assertDraft(type, id);
  await q(`DELETE FROM ${TABLE[type]} WHERE id=$1`, [id]);
  await audit(a.id, `${type}.delete`, type, id);
}
/** Cria um novo rascunho a partir de qualquer item (útil para reaproveitar/versionar conteúdo). */
export async function duplicate(a: Actor, type: ContentType, id: string): Promise<string> {
  assertEditor(a);
  const full: any = await getContent(a, type, id);
  const title = `${full.title} (cópia)`.slice(0, 140);
  let nid: string;
  if (type === "journey") {
    nid = await createJourney(a, { topicId: full.topic_id, title, summary: full.summary, days: full.days, kind: full.kind });
    await setJourneySteps(a, nid, full.steps.map((s: any) => ({ title: s.title, passage: s.passage, context: s.context, explanation: s.explanation, application: s.application, extra: s.extra, question: s.question })));
  } else if (type === "reflection") {
    nid = await createReflection(a, { topicId: full.topic_id, passageId: full.passage_id, title, body: full.body, application: full.application, question: full.question });
  } else if (type === "activity") {
    nid = await createActivity(a, { title, invitation: full.invitation, topicId: full.topic_id });
  } else throw new HttpError(400, "Tipo não duplicável");
  await audit(a.id, `${type}.duplicate`, type, nid, { from: id });
  return nid;
}
/** Transição em lote: cada item é validado individualmente (papel, autor, etapas completas). */
export async function bulkTransition(a: Actor, type: ContentType, ids: string[], to: ContentStatus, comment?: string | null) {
  const out: { id: string; ok: boolean; error?: string }[] = [];
  for (const id of z.array(z.string().uuid()).max(500).parse(ids)) {
    try { await transition(a, type, id, { to, comment }); out.push({ id, ok: true }); }
    catch (e: any) { out.push({ id, ok: false, error: e.message }); }
  }
  return out;
}

// Destaque (promoção): um único item por vez, só publicado.
export async function promote(a: Actor, journeyId: string, input: z.input<typeof promoteSchema>) {
  if (!["admin", "publisher"].includes(a.role)) throw forbidden();
  const d = promoteSchema.parse(input);
  const j = await load("journey", journeyId);
  if (j.status !== "published") throw new HttpError(409, "Só conteúdo publicado pode ser promovido");
  await tx(async (c) => {
    await c.query("UPDATE learning_journeys SET featured=false, feature_headline=NULL, feature_until=NULL WHERE featured");
    await c.query("UPDATE learning_journeys SET featured=true, feature_headline=$2, feature_until=$3 WHERE id=$1", [journeyId, d.headline, d.until ?? null]);
  });
  await audit(a.id, "journey.promote", "journey", journeyId, { headline: d.headline, until: d.until ?? null });
}
/** Define (ou remove) a jornada "Primeiros 7 dias": única, e só publicada. */
export async function setStarter(a: Actor, journeyId: string, on: boolean) {
  if (!["admin", "publisher"].includes(a.role)) throw forbidden();
  const j = await load("journey", journeyId);
  if (on && j.status !== "published") throw new HttpError(409, "Só uma jornada publicada pode ser a de entrada");
  await tx(async (c) => {
    if (on) await c.query("UPDATE learning_journeys SET starter=false WHERE starter");
    await c.query("UPDATE learning_journeys SET starter=$2 WHERE id=$1", [journeyId, on]);
  });
  await audit(a.id, on ? "journey.starter.set" : "journey.starter.unset", "journey", journeyId);
}
export async function unpromote(a: Actor, journeyId: string) {
  if (!["admin", "publisher"].includes(a.role)) throw forbidden();
  await q("UPDATE learning_journeys SET featured=false, feature_headline=NULL, feature_until=NULL WHERE id=$1", [journeyId]);
  await audit(a.id, "journey.unpromote", "journey", journeyId);
}

// Temas
export async function listTopicsAdmin() { return q("SELECT id,slug,name,description,sort_order AS \"sortOrder\" FROM topics ORDER BY sort_order,name"); }
export async function saveTopic(a: Actor, input: { id?: string; name: string; description?: string | null; sortOrder?: number }) {
  assertEditor(a);
  const d = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(2).max(60), description: z.string().trim().max(300).nullish(), sortOrder: z.number().int().min(0).max(999).optional() }).parse(input);
  const slug = d.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const r = d.id
    ? await one<{ id: string }>("UPDATE topics SET name=$2,description=$3,sort_order=COALESCE($4,sort_order) WHERE id=$1 RETURNING id", [d.id, d.name, d.description ?? null, d.sortOrder ?? null])
    : await one<{ id: string }>("INSERT INTO topics(slug,name,description,sort_order) VALUES ($1,$2,$3,COALESCE($4,(SELECT coalesce(max(sort_order),0)+1 FROM topics))) RETURNING id", [slug, d.name, d.description ?? null, d.sortOrder ?? null]);
  if (!r) throw notFound();
  await audit(a.id, d.id ? "topic.update" : "topic.create", "topic", r.id);
  return r.id;
}

// Equipe (perfis de acesso). Somente administradores; sem acesso a dados de uso individuais.
export async function listStaff(a: Actor) {
  if (a.role !== "admin") throw forbidden();
  return q(`SELECT id,email,display_name AS "displayName",role,created_at AS "createdAt" FROM users WHERE role<>'user' ORDER BY role,email`);
}
export async function setRoleByEmail(a: Actor, email: string, role: string) {
  if (a.role !== "admin") throw forbidden();
  const r = z.enum(ROLES).parse(role);
  const u = await one<{ id: string; role: string }>("SELECT id,role FROM users WHERE lower(email)=lower($1)", [email.trim()]);
  if (!u) throw new HttpError(404, "Nenhuma conta com esse e-mail. A pessoa precisa criar a conta no app primeiro.");
  if (u.id === a.id && r !== "admin") throw new HttpError(409, "Você não pode remover o seu próprio acesso de administrador.");
  if (u.role === "admin" && r !== "admin" && (await one<{ n: number }>("SELECT count(*)::int AS n FROM users WHERE role='admin'"))!.n <= 1)
    throw new HttpError(409, "É preciso manter ao menos um administrador.");
  await q("UPDATE users SET role=$2 WHERE id=$1", [u.id, r]);
  await audit(a.id, "user.role", "user", u.id, { from: u.role, to: r });
}

export async function dashboard(a: Actor) {
  const rows = await q<{ t: string; status: string; n: number }>(`
    SELECT 'journey' t,status,count(*)::int n FROM learning_journeys GROUP BY status UNION ALL
    SELECT 'reflection',status,count(*)::int FROM reflections GROUP BY status UNION ALL
    SELECT 'activity',status,count(*)::int FROM practical_activities GROUP BY status UNION ALL
    SELECT 'song',status,count(*)::int FROM songs GROUP BY status UNION ALL
    SELECT 'resource',status,count(*)::int FROM resources GROUP BY status`);
  const featured = await one(`SELECT id,title,feature_headline AS headline,feature_until AS until FROM learning_journeys WHERE featured`);
  return { counts: rows, featured };
}
export async function auditLog(a: Actor, limit = 100) {
  if (!["admin"].includes(a.role)) throw forbidden();
  return q("SELECT id,actor_id AS \"actorId\",action,entity,entity_id AS \"entityId\",created_at AS \"createdAt\" FROM audit_logs ORDER BY id DESC LIMIT $1", [limit]);
}

/** Indicadores agregados. Sem dados individuais; contagens pequenas são suprimidas. */
export async function aggregateMetrics(a: Actor) {
  if (!["admin", "analyst"].includes(a.role)) throw forbidden();
  const [totals, topics, mode] = await Promise.all([
    one(`SELECT (SELECT count(DISTINCT user_id) FROM user_progress WHERE completed_at > now()-interval '30 days')::int AS active30,
                (SELECT count(*) FROM user_progress WHERE kind='step')::int AS "stepsCompleted",
                (SELECT count(*) FROM learning_journeys WHERE status='published')::int AS "publishedJourneys"`),
    q(`SELECT tp.name, count(DISTINCT up.user_id)::int AS users FROM user_progress up
       JOIN journey_steps s ON s.id=up.ref_id AND up.kind='step' JOIN learning_journeys j ON j.id=s.journey_id
       JOIN topics tp ON tp.id=j.topic_id GROUP BY tp.name ORDER BY users DESC`),
    q(`SELECT p.mode, count(*)::int AS users FROM user_preferences p
       WHERE p.onboarded AND EXISTS (SELECT 1 FROM user_consents c WHERE c.user_id=p.user_id AND c.purpose='aggregate_analytics' AND c.granted) GROUP BY p.mode`),
  ]);
  const t = totals as any;
  return {
    activeUsers30d: suppressSmall(t.active30), stepsCompleted: t.stepsCompleted, publishedJourneys: t.publishedJourneys,
    topics: topics.map((x: any) => ({ name: x.name, users: suppressSmall(x.users) })),
    mode: mode.map((x: any) => ({ mode: x.mode, users: suppressSmall(x.users) })),
  };
}
