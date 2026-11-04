import { z } from "zod";
import { noteSchema, preferencesSchema, rankJourneys, stepProgressSchema } from "@jornada/shared";
import { one, q } from "../db";
import { decrypt, encrypt } from "../crypto";
import { HttpError, notFound } from "../errors";

const PUBLISHED = "status = 'published'";

/** Ritmo: valorizar cada etapa/desafio. Ajuste os limites aqui. */
export const PACING = { perJourneyPerDay: 1, perDay: 2, activitiesPerDay: 1 };
const PTZ = "America/Sao_Paulo";
export type Pacing = { locked: boolean; reason?: string };
export type Lock = { locked: boolean; reason?: string; days?: number; hours?: number };
/** Horas até a meia-noite de São Paulo (quando o limite diário libera). */
export function hoursToTomorrow(now = new Date()) {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: PTZ, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const h = Number(p.find((x) => x.type === "hour")!.value) % 24, m = Number(p.find((x) => x.type === "minute")!.value);
  return Math.max(1, Math.ceil(((23 - h) * 60 + (60 - m)) / 60));
}
/** Desafio em andamento (algum progresso, ainda não concluído), com a previsão de quando termina. */
async function activeChallenge(userId: string) {
  return one<{ id: string; title: string; total: number; done: number; doneToday: boolean }>(
    `SELECT j.id,j.title,(SELECT count(*)::int FROM journey_steps s WHERE s.journey_id=j.id) AS total,
        (SELECT count(*)::int FROM user_progress up WHERE up.user_id=$1 AND up.kind='step' AND up.journey_id=j.id) AS done,
        EXISTS(SELECT 1 FROM user_progress up WHERE up.user_id=$1 AND up.kind='step' AND up.journey_id=j.id AND (up.completed_at AT TIME ZONE '${PTZ}')::date = (now() AT TIME ZONE '${PTZ}')::date) AS "doneToday"
       FROM learning_journeys j WHERE j.kind='challenge' AND j.${PUBLISHED}
        AND EXISTS (SELECT 1 FROM user_progress up WHERE up.user_id=$1 AND up.kind='step' AND up.journey_id=j.id)
        AND (SELECT count(*) FROM user_progress up WHERE up.user_id=$1 AND up.kind='step' AND up.journey_id=j.id) < (SELECT count(*) FROM journey_steps s WHERE s.journey_id=j.id)
       ORDER BY 1 LIMIT 1`, [userId]);
}
function lockFrom(ac: { title: string; total: number; done: number; doneToday: boolean }): Lock {
  const remaining = ac.total - ac.done;
  const days = ac.doneToday ? remaining : Math.max(0, remaining - 1); // 1 etapa por dia
  return { locked: true, days, reason: `Libera ao concluir “${ac.title}” — ${days === 0 ? "ainda hoje" : `em cerca de ${days} dia${days > 1 ? "s" : ""}`}. Cada desafio merece o seu tempo.` };
}
/** Desafio ainda não iniciado fica trancado enquanto outro estiver em andamento. */
export async function challengeLock(userId: string, journeyId: string): Promise<Lock> {
  const j = await one<{ kind: string }>("SELECT kind FROM learning_journeys WHERE id=$1", [journeyId]);
  if (j?.kind !== "challenge") return { locked: false };
  if (await one("SELECT 1 FROM user_progress WHERE user_id=$1 AND kind='step' AND journey_id=$2", [userId, journeyId])) return { locked: false };
  const ac = await activeChallenge(userId);
  return ac && ac.id !== journeyId ? lockFrom(ac) : { locked: false };
}
/** Etapas já concluídas pelo usuário continuam livres para revisitar ("Refazer"). */
export async function stepPacing(userId: string, stepId: string): Promise<Pacing> {
  const st = await one<{ journey_id: string }>("SELECT journey_id FROM journey_steps WHERE id=$1", [stepId]);
  if (!st) return { locked: false };
  if (await one("SELECT 1 FROM user_progress WHERE user_id=$1 AND kind='step' AND ref_id=$2", [userId, stepId])) return { locked: false };
  const c = await one<{ total: number; journey: number }>(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE journey_id=$2)::int AS journey FROM user_progress
      WHERE user_id=$1 AND kind='step' AND (completed_at AT TIME ZONE '${PTZ}')::date = (now() AT TIME ZONE '${PTZ}')::date`, [userId, st.journey_id]);
  const h = hoursToTomorrow();
  if (c && c.journey >= PACING.perJourneyPerDay)
    return { locked: true, reason: `Você já fez a etapa de hoje desta jornada. Libera em cerca de ${h}h (amanhã): dar tempo para a Palavra assentar também faz parte.` };
  if (c && c.total >= PACING.perDay)
    return { locked: true, reason: `Hoje você já concluiu ${PACING.perDay} etapas. Libera em cerca de ${h}h (amanhã): aproveite para refletir.` };
  const lock = await challengeLock(userId, st.journey_id);
  if (lock.locked) return { locked: true, reason: lock.reason };
  return { locked: false };
}

const passageSel = `json_build_object('id',p.id,'reference', p.book||' '||p.chapter||':'||p.verse_start||
  CASE WHEN p.verse_end>p.verse_start THEN '-'||p.verse_end ELSE '' END,
  'text',p.text,'translation',t.code,'license',t.license,
  'bookmarked',EXISTS(SELECT 1 FROM user_bookmarks ub WHERE ub.user_id=$2 AND ub.passage_id=p.id)) AS passage`; // $2 = id do usuário em todas as consultas que usam este trecho

export async function getPreferences(userId: string) {
  return one(`SELECT goal, topic_slugs AS "topicSlugs", mode, daily_minutes AS "dailyMinutes",
    to_char(reminder_time,'HH24:MI') AS "reminderTime", anchor, onboarded FROM user_preferences WHERE user_id=$1`, [userId]);
}
export async function savePreferences(userId: string, input: z.input<typeof preferencesSchema>) {
  const d = preferencesSchema.parse(input);
  await q(`UPDATE user_preferences SET goal=$2, topic_slugs=$3, mode=$4, daily_minutes=$5, reminder_time=$6, anchor=$7,
    onboarded=true, updated_at=now() WHERE user_id=$1`,
    [userId, d.goal ?? null, d.topicSlugs, d.mode, d.dailyMinutes, d.reminderTime ?? null, d.anchor || null]);
  // Quem escolhe um horário aceita explicitamente o lembrete da hora da Palavra (pode desligar quando quiser).
  await q("UPDATE notification_preferences SET enabled=$2, reading_reminder=$2 WHERE user_id=$1", [userId, !!d.reminderTime]);
  // Consentimento de personalização: registrado quando o usuário declara preferências.
  await q("INSERT INTO user_consents(user_id,purpose,granted) VALUES ($1,'personalization',$2)", [userId, d.topicSlugs.length > 0]);
}

export const listTopics = () => q("SELECT id,slug,name,description FROM topics ORDER BY sort_order,name");

export async function todayReflection(userId: string, today = new Date().toISOString().slice(0, 10)) {
  const r = await one(
    `SELECT r.id,r.title,r.body,r.application,r.question,r.audio_url AS "audioUrl", tp.slug AS "topicSlug", ${passageSel},
       EXISTS(SELECT 1 FROM user_progress up WHERE up.user_id=$2 AND up.kind='reflection' AND up.ref_id=r.id) AS done
     FROM reflections r LEFT JOIN topics tp ON tp.id=r.topic_id LEFT JOIN bible_passages p ON p.id=r.passage_id LEFT JOIN bible_translations t ON t.id=p.translation_id
     WHERE r.status='published' AND r.publish_date <= $1 ORDER BY r.publish_date DESC LIMIT 1`, [today, userId]);
  return r;
}

export async function listJourneys(userId: string, topicSlug?: string) {
  const rows = await q<{ id: string; topicSlug: string; days: number }>(
    `SELECT j.id,j.title,j.summary,j.days,j.kind,j.featured,tp.slug AS "topicSlug",tp.name AS "topicName",
       (SELECT count(*)::int FROM journey_steps s WHERE s.journey_id=j.id) AS "totalSteps",
       (SELECT count(*)::int FROM user_progress up WHERE up.user_id=$1 AND up.journey_id=j.id AND up.kind='step') AS "doneSteps"
     FROM learning_journeys j JOIN topics tp ON tp.id=j.topic_id
     WHERE j.${PUBLISHED} AND ($2::text IS NULL OR tp.slug=$2)
       AND (j.starts_at IS NULL OR j.starts_at <= current_date) AND (j.ends_at IS NULL OR j.ends_at >= current_date)`, [userId, topicSlug ?? null]);
  const prefs = (await getPreferences(userId)) as any;
  const done = new Set(rows.filter((r: any) => r.totalSteps > 0 && r.doneSteps >= r.totalSteps).map((r) => r.id));
  const started = new Set(rows.filter((r: any) => r.doneSteps > 0 && !done.has(r.id)).map((r) => r.id));
  const ranked = rankJourneys(rows, prefs ?? { topicSlugs: [], dailyMinutes: 3 }, done, started) as any[];
  const ac = await activeChallenge(userId);
  // Desafios não iniciados ficam visíveis, porém trancados enquanto outro estiver em andamento.
  return ranked.map((r) => ({ ...r, lock: r.kind === "challenge" && r.doneSteps === 0 && ac && ac.id !== r.id ? lockFrom(ac) : { locked: false } }));
}

/** Item promovido pelo editorial (no máximo um), com o progresso do próprio usuário. */
export async function getFeatured(userId: string) {
  const f: any = await one(`SELECT j.id,j.title,j.summary,j.days,j.kind,tp.slug AS "topicSlug",tp.name AS "topicName",j.feature_headline AS headline,
      (SELECT count(*)::int FROM journey_steps s WHERE s.journey_id=j.id) AS "totalSteps",
      (SELECT count(*)::int FROM user_progress up WHERE up.user_id=$1 AND up.journey_id=j.id AND up.kind='step') AS "doneSteps"
    FROM learning_journeys j JOIN topics tp ON tp.id=j.topic_id
    WHERE j.featured AND j.status='published' AND (j.feature_until IS NULL OR j.feature_until > now())`, [userId]);
  return f ? { ...f, lock: await challengeLock(userId, f.id) } : f;
}

export async function getJourney(userId: string, journeyId: string) {
  const j = await one(`SELECT j.id,j.title,j.summary,j.days,tp.name AS "topicName",tp.slug AS "topicSlug" FROM learning_journeys j
    JOIN topics tp ON tp.id=j.topic_id WHERE j.id=$1 AND j.${PUBLISHED}`, [journeyId]);
  if (!j) throw notFound();
  const lock = await challengeLock(userId, journeyId);
  if (lock.locked) throw new HttpError(423, lock.reason!);
  const steps = await q(
    `SELECT s.id,s.position,s.title,
       EXISTS(SELECT 1 FROM user_progress up WHERE up.user_id=$2 AND up.kind='step' AND up.ref_id=s.id) AS done
     FROM journey_steps s WHERE s.journey_id=$1 ORDER BY s.position`, [journeyId, userId]);
  const next = (steps as any[]).find((x) => !x.done);
  const pace = next ? await stepPacing(userId, next.id) : { locked: false };
  return { ...j, steps, pacing: pace };
}

export async function getStep(userId: string, stepId: string) {
  const s = await one(
    `SELECT s.id,s.journey_id AS "journeyId",s.position,s.title,s.context,s.explanation,s.application,s.extra,s.audio_url AS "audioUrl",
       ${passageSel},
       (SELECT up.completed_at IS NOT NULL FROM user_progress up WHERE up.user_id=$2 AND up.kind='step' AND up.ref_id=s.id) AS done
     FROM journey_steps s JOIN learning_journeys j ON j.id=s.journey_id
     LEFT JOIN bible_passages p ON p.id=s.passage_id LEFT JOIN bible_translations t ON t.id=p.translation_id
     WHERE s.id=$1 AND j.${PUBLISHED}`, [stepId, userId]);
  if (!s) throw notFound();
  const lock = await challengeLock(userId, (s as any).journeyId);
  if (lock.locked) throw new HttpError(423, lock.reason!);
  // Gabarito não é enviado ao cliente; a correção ocorre ao concluir (feedback de aprendizado, sem pontuação).
  const questions = await q(`SELECT id,prompt,options FROM comprehension_questions WHERE step_id=$1`, [stepId]);
  // Louvor relacionado: músicas publicadas do mesmo tema da jornada; rotação estável por etapa.
  const songs = await q(
    `SELECT so.id,so.title,so.lyrics,so.credits FROM songs so
       JOIN song_topics st ON st.song_id=so.id AND NOT st.suggested
       JOIN learning_journeys j ON j.topic_id=st.topic_id
      WHERE j.id=$1 AND so.status='published' ORDER BY md5(so.id::text || $2::text) LIMIT 2`, [(s as any).journeyId, stepId]);
  const nav = await one<{ total: number; next: string | null }>(
    `SELECT count(*)::int AS total, (SELECT n.id FROM journey_steps n WHERE n.journey_id=$1 AND n.position=$2+1) AS next
       FROM journey_steps WHERE journey_id=$1`, [(s as any).journeyId, (s as any).position]);
  return { ...s, questions, songs, totalSteps: nav?.total ?? 0, nextStepId: nav?.next ?? null, pacing: await stepPacing(userId, stepId) };
}

export async function completeStep(userId: string, stepId: string, input: z.input<typeof stepProgressSchema>) {
  const d = stepProgressSchema.parse(input);
  const s = await one<{ journey_id: string }>(
    `SELECT s.journey_id FROM journey_steps s JOIN learning_journeys j ON j.id=s.journey_id WHERE s.id=$1 AND j.${PUBLISHED}`, [stepId]);
  if (!s) throw notFound();
  const pace = await stepPacing(userId, stepId);
  if (pace.locked) throw new HttpError(409, pace.reason!);
  const qn = await one<{ correct_index: number; explanation: string | null }>(
    "SELECT correct_index,explanation FROM comprehension_questions WHERE step_id=$1 ORDER BY id LIMIT 1", [stepId]);
  if (qn) {
    // Só avança quem acerta: resposta errada não registra progresso nem revela a certa (sem nota, sem punição — é só tentar de novo).
    if (d.answerIndex == null) throw new HttpError(422, "Escolha uma resposta para continuar");
    if (qn.correct_index !== d.answerIndex) return { correct: false, hint: "Quase! Releia o texto com calma e tente outra resposta." };
  }
  await q(`INSERT INTO user_progress(user_id,kind,ref_id,journey_id,answer_index) VALUES ($1,'step',$2,$3,$4)
    ON CONFLICT (user_id,kind,ref_id) DO UPDATE SET answer_index=EXCLUDED.answer_index`, [userId, stepId, s.journey_id, d.answerIndex ?? null]);
  return qn ? { correct: true, correctIndex: qn.correct_index, explanation: qn.explanation } : { correct: null };
}

export async function completeReflection(userId: string, reflectionId: string) {
  if (!(await one(`SELECT 1 FROM reflections WHERE id=$1 AND ${PUBLISHED}`, [reflectionId]))) throw notFound();
  await q(`INSERT INTO user_progress(user_id,kind,ref_id) VALUES ($1,'reflection',$2) ON CONFLICT DO NOTHING`, [userId, reflectionId]);
}

/** Prática: 1 por dia. Depois de feita a do dia, as demais ficam visíveis (só o título), trancadas até amanhã. */
async function activityLock(userId: string): Promise<Lock> {
  const c = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM user_progress WHERE user_id=$1 AND kind='activity'
       AND (completed_at AT TIME ZONE '${PTZ}')::date = (now() AT TIME ZONE '${PTZ}')::date`, [userId]);
  if (c && c.n >= PACING.activitiesPerDay) {
    const h = hoursToTomorrow();
    return { locked: true, hours: h, reason: `Você já fez o exercício de hoje. Libera em cerca de ${h}h (amanhã): fazer um de cada vez dá mais sentido.` } as Lock;
  }
  return { locked: false };
}
export async function listActivities(userId: string) {
  const rows = await q<any>(`SELECT a.id,a.title,a.invitation,
    EXISTS(SELECT 1 FROM user_progress up WHERE up.user_id=$1 AND up.kind='activity' AND up.ref_id=a.id) AS done
    FROM practical_activities a WHERE a.${PUBLISHED} ORDER BY a.title`, [userId]);
  const lock = await activityLock(userId);
  return rows.map((r) => r.done || !lock.locked ? { ...r, lock: { locked: false } } : { id: r.id, title: r.title, invitation: null, done: false, lock });
}
export async function completeActivity(userId: string, activityId: string) {
  if (!(await one(`SELECT 1 FROM practical_activities WHERE id=$1 AND ${PUBLISHED}`, [activityId]))) throw notFound();
  if (!(await one("SELECT 1 FROM user_progress WHERE user_id=$1 AND kind='activity' AND ref_id=$2", [userId, activityId]))) {
    const lock = await activityLock(userId);
    if (lock.locked) throw new HttpError(409, lock.reason!);
  }
  await q(`INSERT INTO user_progress(user_id,kind,ref_id) VALUES ($1,'activity',$2) ON CONFLICT DO NOTHING`, [userId, activityId]);
}

// Favoritos
export async function toggleBookmark(userId: string, passageId: string) {
  if (!(await one("SELECT 1 FROM bible_passages WHERE id=$1", [passageId]))) throw notFound();
  const del = await q("DELETE FROM user_bookmarks WHERE user_id=$1 AND passage_id=$2 RETURNING id", [userId, passageId]);
  if (del.length) return { bookmarked: false };
  await q("INSERT INTO user_bookmarks(user_id,passage_id) VALUES ($1,$2)", [userId, passageId]);
  return { bookmarked: true };
}
/** Remoção idempotente (diferente do toggle: nunca recria o favorito se a lista do cliente estiver desatualizada). */
export async function removeBookmark(userId: string, passageId: string) {
  await q("DELETE FROM user_bookmarks WHERE user_id=$1 AND passage_id=$2", [userId, passageId]);
}
/** Favoritos com data e de onde vêm (etapas de jornadas e reflexões publicadas que citam o versículo). */
export const listBookmarks = (userId: string) => q(
  `SELECT b.passage_id AS "passageId", p.book, p.book||' '||p.chapter||':'||p.verse_start||
     CASE WHEN p.verse_end>p.verse_start THEN '-'||p.verse_end ELSE '' END AS reference, p.text,
     b.created_at AS "createdAt",
     COALESCE((SELECT json_agg(x) FROM (
       SELECT 'step'::text AS kind, s.id, s.title, s.journey_id AS "journeyId", j.title AS "journeyTitle", s.position AS "position"
         FROM journey_steps s JOIN learning_journeys j ON j.id=s.journey_id WHERE s.passage_id=b.passage_id AND j.${PUBLISHED}
       UNION ALL
       SELECT 'reflection'::text, r.id, r.title, NULL::uuid, NULL::text, NULL::int
         FROM reflections r WHERE r.passage_id=b.passage_id AND r.${PUBLISHED}
       LIMIT 5) x), '[]'::json) AS sources
   FROM user_bookmarks b JOIN bible_passages p ON p.id=b.passage_id WHERE b.user_id=$1 ORDER BY b.created_at DESC`, [userId]);

// Anotações privadas (cifradas em repouso; sempre isoladas por user_id)
export async function createNote(userId: string, input: z.input<typeof noteSchema>) {
  const d = noteSchema.parse(input);
  return one<{ id: string }>(`INSERT INTO private_notes(user_id,ref_kind,ref_id,body_enc) VALUES ($1,$2,$3,$4) RETURNING id`,
    [userId, d.refKind ?? null, d.refId ?? null, encrypt(d.body)]);
}
export async function listNotes(userId: string) {
  // Contexto da anotação: título do conteúdo, dia/jornada (etapas) e o versículo ligado. Tudo em uma consulta.
  const rows = await q(`SELECT n.id, n.ref_kind AS "refKind", n.ref_id AS "refId", n.body_enc,
      n.created_at AS "createdAt", n.updated_at AS "updatedAt",
      COALESCE(s.title, r.title, a.title) AS "refTitle", s.position AS "stepPosition",
      s.journey_id AS "journeyId", j.title AS "journeyTitle",
      p.passage_id AS "passageId",
      CASE WHEN p.passage_id IS NULL THEN NULL ELSE p.reference END AS "passageRef"
    FROM private_notes n
    LEFT JOIN journey_steps s ON n.ref_kind='step' AND s.id=n.ref_id
    LEFT JOIN learning_journeys j ON j.id=s.journey_id
    LEFT JOIN reflections r ON n.ref_kind='reflection' AND r.id=n.ref_id
    LEFT JOIN practical_activities a ON n.ref_kind='activity' AND a.id=n.ref_id
    LEFT JOIN LATERAL (
      SELECT bp.id AS passage_id, bp.book||' '||bp.chapter||':'||bp.verse_start||
        CASE WHEN bp.verse_end>bp.verse_start THEN '-'||bp.verse_end ELSE '' END AS reference
      FROM bible_passages bp WHERE bp.id = COALESCE(s.passage_id, r.passage_id)
    ) p ON true
    WHERE n.user_id=$1 ORDER BY n.updated_at DESC`, [userId]);
  return rows.map(({ body_enc, ...r }) => ({ ...r, body: decrypt(body_enc) }));
}
export async function updateNote(userId: string, id: string, body: string) {
  const d = noteSchema.pick({ body: true }).parse({ body });
  const r = await q("UPDATE private_notes SET body_enc=$3, updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING id", [id, userId, encrypt(d.body)]);
  if (!r.length) throw notFound();
}
export async function deleteNote(userId: string, id: string) {
  const r = await q("DELETE FROM private_notes WHERE id=$1 AND user_id=$2 RETURNING id", [id, userId]);
  if (!r.length) throw notFound();
}

// Metas semanais flexíveis (anéis): derivadas do tempo diário escolhido. Não fechar um anel não tem consequência.
const GOALS: Record<number, { reflections: number; steps: number; activities: number }> = {
  1: { reflections: 3, steps: 2, activities: 1 }, 3: { reflections: 5, steps: 3, activities: 2 },
  5: { reflections: 6, steps: 5, activities: 3 }, 10: { reflections: 7, steps: 7, activities: 4 },
};
const TZ = "America/Sao_Paulo";

export async function weekOverview(userId: string) {
  const prefs = (await getPreferences(userId)) as any;
  const [w, days, who] = await Promise.all([
    one(`SELECT count(*) FILTER (WHERE kind='reflection')::int AS reflections, count(*) FILTER (WHERE kind='step')::int AS steps,
                count(*) FILTER (WHERE kind='activity')::int AS activities
           FROM user_progress WHERE user_id=$1 AND (completed_at AT TIME ZONE '${TZ}')::date > (now() AT TIME ZONE '${TZ}')::date - 7`, [userId]),
    q(`SELECT to_char(d,'YYYY-MM-DD') AS day, extract(dow FROM d)::int AS dow,
         EXISTS(SELECT 1 FROM user_progress up WHERE up.user_id=$1 AND (up.completed_at AT TIME ZONE '${TZ}')::date = d::date) AS active,
         d::date = (now() AT TIME ZONE '${TZ}')::date AS today
       FROM generate_series((now() AT TIME ZONE '${TZ}')::date - 6, (now() AT TIME ZONE '${TZ}')::date, interval '1 day') d ORDER BY d`, [userId]),
    one(`SELECT u.created_at > now() - interval '7 days' AS newcomer,
           (SELECT ((now() AT TIME ZONE '${TZ}')::date - max((completed_at AT TIME ZONE '${TZ}')::date))::int FROM user_progress WHERE user_id=u.id) AS "daysAway"
         FROM users u WHERE u.id=$1`, [userId]),
  ]);
  const info = who as { newcomer: boolean; daysAway: number | null };
  // Primeira semana: metas mínimas (começar pequeno). Depois, conforme o tempo diário escolhido.
  const goals = info.newcomer ? GOALS[1] : GOALS[prefs?.dailyMinutes ?? 3] ?? GOALS[3];
  const activeDays = (days as any[]).filter((d) => d.active).length;
  // Recomeço sem culpa: após 3+ dias sem atividade (e com histórico), acolhe e oferece a versão de 1 minuto.
  const welcomeBack = info.daysAway != null && info.daysAway >= 3 ? { daysAway: info.daysAway } : null;
  return { week: w as { reflections: number; steps: number; activities: number }, goals, days, activeDays, newcomer: info.newcomer, welcomeBack };
}

/** "Primeiros 7 dias": jornada de entrada (1 minuto por dia), definida pelo editorial. */
export async function getStarter(userId: string) {
  const j = await one<any>(`SELECT j.id,j.title,j.summary,j.days FROM learning_journeys j WHERE j.starter AND j.${PUBLISHED}`);
  if (!j) return null;
  const steps = await q<any>(`SELECT s.id,s.position,s.title,
      EXISTS(SELECT 1 FROM user_progress up WHERE up.user_id=$2 AND up.kind='step' AND up.ref_id=s.id) AS done
    FROM journey_steps s WHERE s.journey_id=$1 ORDER BY s.position`, [j.id, userId]);
  const next = steps.find((s) => !s.done);
  const doneSteps = steps.filter((s) => s.done).length;
  const pace = next ? await stepPacing(userId, next.id) : { locked: false };
  return { id: j.id, title: j.title, summary: j.summary, totalSteps: steps.length, doneSteps, complete: !next, nextStepId: next?.id ?? null, nextStepTitle: next?.title ?? null, day: Math.min(doneSteps + 1, steps.length), lockedToday: pace.locked, pacingReason: pace.reason ?? null };
}

// Minha Jornada: visão exclusivamente individual, sem indicadores de fé.
export async function myJourney(userId: string, since = new Date(Date.now() - 7 * 864e5)) {
  const [counts, recent, week, topics] = await Promise.all([
    one(`SELECT count(*) FILTER (WHERE kind='reflection')::int AS reflections,
                count(*) FILTER (WHERE kind='step')::int AS steps,
                count(*) FILTER (WHERE kind='activity')::int AS activities FROM user_progress WHERE user_id=$1`, [userId]),
    q(`SELECT up.kind, up.completed_at AS "completedAt", COALESCE(s.title, r.title, a.title) AS title
       FROM user_progress up LEFT JOIN journey_steps s ON up.kind='step' AND s.id=up.ref_id
       LEFT JOIN reflections r ON up.kind='reflection' AND r.id=up.ref_id
       LEFT JOIN practical_activities a ON up.kind='activity' AND a.id=up.ref_id
       WHERE up.user_id=$1 ORDER BY up.completed_at DESC LIMIT 10`, [userId]),
    one(`SELECT count(*)::int AS items FROM user_progress WHERE user_id=$1 AND completed_at >= $2`, [userId, since]),
    q(`SELECT DISTINCT tp.name FROM user_progress up JOIN journey_steps s ON s.id=up.ref_id AND up.kind='step'
       JOIN learning_journeys j ON j.id=s.journey_id JOIN topics tp ON tp.id=j.topic_id WHERE up.user_id=$1`, [userId]),
  ]);
  const finished = await q(`SELECT j.id,j.title FROM learning_journeys j
    WHERE (SELECT count(*) FROM journey_steps s WHERE s.journey_id=j.id) > 0
    AND (SELECT count(*) FROM journey_steps s WHERE s.journey_id=j.id) =
        (SELECT count(*) FROM user_progress up WHERE up.user_id=$1 AND up.journey_id=j.id AND up.kind='step')`, [userId]);
  const c = counts as any;
  const all = [
    { label: "Primeira reflexão concluída", done: c.reflections >= 1 },
    { label: "Primeiro tema estudado", done: topics.length >= 1 },
    { label: "Primeira jornada concluída", done: finished.length >= 1 },
    { label: "Cinco temas explorados", done: topics.length >= 5 },
  ];
  return { counts, recent, weekItems: (week as any).items, topicsStudied: topics.map((t: any) => t.name), finishedJourneys: finished,
    milestones: all.filter((m) => m.done).map((m) => m.label), allMilestones: all, ...(await weekOverview(userId)) };
}

/** "Saiba mais": indicações publicadas (link para a fonte), por tema e/ou público. Não depende de IA. */
export async function listResources(f: { topic?: string; audience?: string; limit?: number } = {}) {
  const lim = Math.min(Math.max(f.limit ?? 6, 1), 30);
  return q(`SELECT DISTINCT ON (r.id) r.id,r.kind,r.source,r.title,r.url,r.blurb,(r.body IS NOT NULL OR r.video_url IS NOT NULL OR r.audio_url IS NOT NULL) AS "hasContent",r.image_media_id AS "imageId",r.published_on::text AS "publishedOn",r.audiences,r.published_at
    FROM resources r LEFT JOIN resource_topics rt ON rt.resource_id=r.id AND NOT rt.suggested LEFT JOIN topics tp ON tp.id=rt.topic_id
    WHERE r.status='published' AND ($1::text IS NULL OR tp.slug=$1) AND ($2::text IS NULL OR $2=ANY(r.audiences))
    ORDER BY r.id`, [f.topic ?? null, f.audience ?? null]).then((rows: any[]) =>
      rows.sort((a, b) => String(b.publishedOn ?? "").localeCompare(String(a.publishedOn ?? ""))).slice(0, lim).map(({ published_at: _p, ...r }) => r));
}

/** Leitura do conteúdo guardado no nosso banco (somente publicado). */
export async function getLibraryItem(id: string) {
  return one(`SELECT r.id,r.kind,r.source,r.title,r.url AS "originalUrl",r.blurb,r.body,r.author_name AS "authorName",r.audio_url AS "audioUrl",r.video_url AS "videoUrl",
      r.image_media_id AS "imageId",r.published_on::text AS "publishedOn",r.audiences
    FROM resources r WHERE r.id=$1 AND r.status='published'`, [id]);
}
