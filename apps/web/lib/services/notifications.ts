import { z } from "zod";
import type { Role } from "@jornada/shared";
import { one, q, tx } from "../db";
import { HttpError, forbidden, notFound } from "../errors";
import { audit } from "./audit";
import { pushConfigured, sendApns } from "../push";

type Actor = { id: string; role: Role };
const HHMM = z.string().regex(/^\d{2}:\d{2}$/);

// ---------- Preferências do usuário ----------
export const settingsSchema = z.object({
  enabled: z.boolean(), readingReminder: z.boolean(), nudge: z.boolean(), newContent: z.boolean(),
  reminderTime: HHMM.nullish(), quietStart: HHMM.default("21:00"), quietEnd: HHMM.default("07:00"), maxPerWeek: z.number().int().min(0).max(7).default(3),
});
export async function getSettings(userId: string) {
  return one(`SELECT np.enabled, np.reading_reminder AS "readingReminder", np.nudge, np.new_content AS "newContent",
      to_char(up.reminder_time,'HH24:MI') AS "reminderTime", to_char(np.quiet_start,'HH24:MI') AS "quietStart", to_char(np.quiet_end,'HH24:MI') AS "quietEnd", np.max_per_week AS "maxPerWeek"
    FROM notification_preferences np JOIN user_preferences up ON up.user_id=np.user_id WHERE np.user_id=$1`, [userId]);
}
export async function saveSettings(userId: string, input: z.input<typeof settingsSchema>) {
  const d = settingsSchema.parse(input);
  await tx(async (c) => {
    await c.query(`UPDATE notification_preferences SET enabled=$2,reading_reminder=$3,nudge=$4,new_content=$5,quiet_start=$6,quiet_end=$7,max_per_week=$8 WHERE user_id=$1`,
      [userId, d.enabled, d.readingReminder, d.nudge, d.newContent, d.quietStart, d.quietEnd, d.maxPerWeek]);
    await c.query("UPDATE user_preferences SET reminder_time=$2, updated_at=now() WHERE user_id=$1", [userId, d.reminderTime ?? null]);
  });
}

// ---------- Dispositivos ----------
export async function registerDevice(userId: string, input: { platform: string; token: string; env?: string }) {
  const d = z.object({ platform: z.enum(["ios", "android", "web"]), token: z.string().trim().min(20).max(300), env: z.enum(["sandbox", "production"]).default("production") }).parse(input);
  await q(`INSERT INTO devices(user_id,platform,token,env) VALUES ($1,$2,$3,$4)
    ON CONFLICT (platform,token) DO UPDATE SET user_id=EXCLUDED.user_id, env=EXCLUDED.env, last_seen=now()`, [userId, d.platform, d.token, d.env]);
}
export async function unregisterDevice(userId: string, token: string) {
  await q("DELETE FROM devices WHERE user_id=$1 AND token=$2", [userId, token]);
}

// ---------- Caixa de entrada do usuário ----------
export async function inbox(userId: string, limit = 30) {
  return q(`SELECT n.id,n.title,n.body,n.link_kind AS "linkKind",n.link_id AS "linkId",i.created_at AS "createdAt",i.read_at IS NOT NULL AS read
    FROM notification_inbox i JOIN notifications n ON n.id=i.notification_id WHERE i.user_id=$1 ORDER BY i.created_at DESC LIMIT $2`, [userId, Math.min(limit, 100)]);
}
export async function markRead(userId: string, id?: string) {
  await q("UPDATE notification_inbox SET read_at=now() WHERE user_id=$1 AND read_at IS NULL AND ($2::uuid IS NULL OR notification_id=$2)", [userId, id ?? null]);
}

// ---------- CMS ----------
const canCompose = (a: Actor) => ["admin", "editor", "publisher"].includes(a.role);
const canSend = (a: Actor) => ["admin", "publisher"].includes(a.role);
export const composeSchema = z.object({
  title: z.string().trim().min(3).max(80), body: z.string().trim().min(3).max(240),
  linkKind: z.enum(["none", "resource", "journey", "today", "praticar"]).default("none"), linkId: z.string().uuid().nullish(),
  target: z.enum(["all", "topic"]).default("all"), topicSlug: z.string().max(60).nullish(),
});
async function validateLink(d: z.infer<typeof composeSchema>) {
  if (d.target === "topic" && (!d.topicSlug || !(await one("SELECT 1 FROM topics WHERE slug=$1", [d.topicSlug])))) throw new HttpError(422, "Escolha um tema válido");
  if (d.linkKind === "resource" || d.linkKind === "journey") {
    if (!d.linkId) throw new HttpError(422, "Escolha o conteúdo ligado à notificação");
    const t = d.linkKind === "resource" ? "resources" : "learning_journeys";
    if (!(await one(`SELECT 1 FROM ${t} WHERE id=$1 AND status='published'`, [d.linkId]))) throw new HttpError(422, "O conteúdo ligado precisa estar publicado");
  }
}
export async function createNotification(a: Actor, input: z.input<typeof composeSchema>) {
  if (!canCompose(a)) throw forbidden();
  const d = composeSchema.parse(input); await validateLink(d);
  const r = await one<{ id: string }>(`INSERT INTO notifications(title,body,link_kind,link_id,target,topic_slug,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [d.title, d.body, d.linkKind, d.linkKind === "resource" || d.linkKind === "journey" ? d.linkId : null, d.target, d.target === "topic" ? d.topicSlug : null, a.id]);
  await audit(a.id, "notification.create", "notification", r!.id);
  return r!.id;
}
export async function updateNotification(a: Actor, id: string, input: z.input<typeof composeSchema>) {
  if (!canCompose(a)) throw forbidden();
  const cur = await one<{ status: string }>("SELECT status FROM notifications WHERE id=$1", [id]); if (!cur) throw notFound();
  if (cur.status !== "draft") throw new HttpError(409, "Notificação já enviada não pode ser editada");
  const d = composeSchema.parse(input); await validateLink(d);
  await q(`UPDATE notifications SET title=$2,body=$3,link_kind=$4,link_id=$5,target=$6,topic_slug=$7 WHERE id=$1`,
    [id, d.title, d.body, d.linkKind, d.linkKind === "resource" || d.linkKind === "journey" ? d.linkId : null, d.target, d.target === "topic" ? d.topicSlug : null]);
}
export async function deleteNotification(a: Actor, id: string) {
  if (!canCompose(a)) throw forbidden();
  const r = await q("DELETE FROM notifications WHERE id=$1 AND status='draft' RETURNING id", [id]);
  if (!r.length) throw new HttpError(409, "Só rascunhos podem ser excluídos");
  await audit(a.id, "notification.delete", "notification", id);
}
export async function listNotifications(a: Actor) {
  if (!canCompose(a)) throw forbidden();
  return q(`SELECT n.id,n.title,n.body,n.link_kind AS "linkKind",n.link_id AS "linkId",n.target,n.topic_slug AS "topicSlug",n.status,n.sent_at AS "sentAt",n.recipients,n.created_at AS "createdAt",
    (SELECT count(*)::int FROM push_outbox o WHERE o.notification_id=n.id AND o.status='sent') AS "pushSent",
    (SELECT count(*)::int FROM push_outbox o WHERE o.notification_id=n.id AND o.status='pending') AS "pushPending",
    (SELECT count(*)::int FROM push_outbox o WHERE o.notification_id=n.id AND o.status IN ('failed','skipped')) AS "pushNotSent",
    (SELECT count(*)::int FROM notification_inbox i WHERE i.notification_id=n.id AND i.read_at IS NOT NULL) AS "opened"
    FROM notifications n ORDER BY n.created_at DESC LIMIT 100`);
}
const RECIPIENTS = `FROM users u JOIN notification_preferences np ON np.user_id=u.id JOIN user_preferences up ON up.user_id=u.id
  WHERE np.new_content AND ($1::text IS NULL OR $1 = ANY(up.topic_slugs))`;
export async function previewRecipients(a: Actor, id: string) {
  if (!canCompose(a)) throw forbidden();
  const n = await one<any>("SELECT target,topic_slug FROM notifications WHERE id=$1", [id]); if (!n) throw notFound();
  const r = await one<{ n: number }>(`SELECT count(*)::int AS n ${RECIPIENTS}`, [n.target === "topic" ? n.topic_slug : null]);
  return { recipients: r!.n };
}
/** Envia: grava na caixa de entrada de cada destinatário e enfileira push para quem ativou notificações. */
export async function sendNotification(a: Actor, id: string) {
  if (!canSend(a)) throw forbidden();
  const out = await tx(async (c) => {
    const n = (await c.query("SELECT * FROM notifications WHERE id=$1 FOR UPDATE", [id])).rows[0]; if (!n) throw notFound();
    if (n.status !== "draft") throw new HttpError(409, "Esta notificação já foi enviada");
    const slug = n.target === "topic" ? n.topic_slug : null;
    const ins = await c.query(`INSERT INTO notification_inbox(user_id,notification_id) SELECT u.id,$2 ${RECIPIENTS} ON CONFLICT DO NOTHING RETURNING user_id`, [slug, id]);
    await c.query(`INSERT INTO push_outbox(notification_id,device_id) SELECT $2,d.id FROM devices d JOIN notification_preferences np ON np.user_id=d.user_id
      WHERE np.enabled AND d.user_id = ANY($1::uuid[])`, [ins.rows.map((r) => r.user_id), id]);
    await c.query("UPDATE notifications SET status='sent', sent_by=$2, sent_at=now(), recipients=$3 WHERE id=$1", [id, a.id, ins.rowCount]);
    return ins.rowCount ?? 0;
  });
  await audit(a.id, "notification.send", "notification", id, { recipients: out });
  const pushed = await processOutbox();
  return { recipients: out, ...pushed };
}
/** Envio de teste: só para os dispositivos do próprio autor, sem registrar na caixa de entrada de ninguém. */
export async function sendTest(a: Actor, id: string) {
  if (!canCompose(a)) throw forbidden();
  const n = await one<any>("SELECT * FROM notifications WHERE id=$1", [id]); if (!n) throw notFound();
  const devs = await q<any>("SELECT token,env FROM devices WHERE user_id=$1", [a.id]);
  if (!devs.length) throw new HttpError(409, "Nenhum dispositivo seu registrado. Abra o app no seu aparelho e ative as notificações.");
  const res = [];
  for (const d of devs) res.push(await sendApns(d.token, d.env, { title: `[Teste] ${n.title}`, body: n.body, data: payloadData(n) }));
  return { results: res };
}
const payloadData = (n: any) => ({ nid: String(n.id), linkKind: String(n.link_kind), linkId: n.link_id ? String(n.link_id) : "" });

export const OUTBOX_MAX_ATTEMPTS = 5;
const OUTBOX_LEASE_SECONDS = 300;
const backoffSeconds = (attempts: number) => Math.min(3600, 60 * 2 ** (attempts - 1)); // 1, 2, 4, 8, 16 min…

/**
 * Processa a fila de push respeitando horário de silêncio (America/Sao_Paulo) e o teto semanal do usuário.
 * Seguro para múltiplos executores: cada item é reservado atomicamente (FOR UPDATE SKIP LOCKED + lease), então
 * dois processos nunca enviam o mesmo item. Se o processo morrer, o lease expira e o item volta à fila.
 * Sem credenciais APNs nada é consumido: os itens continuam pendentes.
 */
export async function processOutbox(limit = 500) {
  const res = { pushSent: 0, pushFailed: 0, pushSkipped: 0, pushDeferred: 0, pushRetry: 0 };
  if (!pushConfigured()) return { ...res, pushNotConfigured: true };

  // 1) candidatos (sem lock): elegíveis agora e não reservados por outro executor
  const rows = await q<any>(`SELECT o.id,o.attempts,d.token,d.env,d.user_id,n.id AS notification_id,n.title,n.body,n.link_kind,n.link_id,
      to_char(np.quiet_start,'HH24:MI') AS qs,to_char(np.quiet_end,'HH24:MI') AS qe,np.max_per_week,
      to_char(now() AT TIME ZONE 'America/Sao_Paulo','HH24:MI') AS nowhm,
      (SELECT count(*)::int FROM push_outbox x JOIN devices dd ON dd.id=x.device_id WHERE dd.user_id=d.user_id AND x.status='sent' AND x.sent_at > now()-interval '7 days') AS sent7
    FROM push_outbox o JOIN devices d ON d.id=o.device_id JOIN notifications n ON n.id=o.notification_id JOIN notification_preferences np ON np.user_id=d.user_id
    WHERE o.status='pending' AND o.next_attempt_at <= now() AND (o.locked_until IS NULL OR o.locked_until < now()) ORDER BY o.id LIMIT $1`, [limit]);
  const eligible: any[] = [];
  for (const r of rows) {
    const quiet = r.qs > r.qe ? (r.nowhm >= r.qs || r.nowhm < r.qe) : (r.nowhm >= r.qs && r.nowhm < r.qe);
    if (quiet) res.pushDeferred++; else eligible.push(r); // silêncio: permanece pendente
  }
  if (!eligible.length) return res;

  // 2) reserva atômica: só processa o que ESTE executor conseguiu travar
  const claimed = new Set<string>((await q<{ id: string }>(`UPDATE push_outbox SET locked_until=now()+make_interval(secs => $2), attempts=attempts+1
    WHERE id IN (SELECT id FROM push_outbox WHERE id = ANY($1::bigint[]) AND status='pending' AND next_attempt_at <= now()
                 AND (locked_until IS NULL OR locked_until < now()) ORDER BY id FOR UPDATE SKIP LOCKED) RETURNING id`,
    [eligible.map((r) => r.id), OUTBOX_LEASE_SECONDS])).map((r) => String(r.id)));

  const sentByUser = new Map<string, number>();
  for (const r of eligible) {
    if (!claimed.has(String(r.id))) continue;
    const attempts = r.attempts + 1;
    const used = r.sent7 + (sentByUser.get(r.user_id) ?? 0);
    if (used >= r.max_per_week) {
      await q("UPDATE push_outbox SET status='skipped', error='teto semanal do usuário', locked_until=NULL WHERE id=$1", [r.id]); res.pushSkipped++; continue;
    }
    let out;
    try { out = await sendApns(r.token, r.env, { title: r.title, body: r.body, data: payloadData(r) }); }
    catch (e: any) { out = { status: "failed" as const, error: String(e?.message ?? e).slice(0, 200), retryable: true }; }
    if (out.status === "sent") {
      await q("UPDATE push_outbox SET status='sent', error=NULL, sent_at=now(), locked_until=NULL WHERE id=$1", [r.id]);
      sentByUser.set(r.user_id, (sentByUser.get(r.user_id) ?? 0) + 1); res.pushSent++;
    } else if (out.status === "skipped") { // não configurado: devolve à fila sem consumir tentativa
      await q("UPDATE push_outbox SET attempts=attempts-1, locked_until=NULL, error=$2 WHERE id=$1", [r.id, out.error ?? null]); res.pushDeferred++;
    } else if (out.retryable && attempts < OUTBOX_MAX_ATTEMPTS) {
      await q("UPDATE push_outbox SET error=$2, locked_until=NULL, next_attempt_at=now()+make_interval(secs => $3) WHERE id=$1", [r.id, out.error ?? null, backoffSeconds(attempts)]); res.pushRetry++;
    } else {
      await q("UPDATE push_outbox SET status='failed', error=$2, locked_until=NULL WHERE id=$1", [r.id, out.error ?? null]); res.pushFailed++;
    }
  }
  return res;
}
