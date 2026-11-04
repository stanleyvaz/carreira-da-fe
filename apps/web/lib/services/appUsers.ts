import { randomInt } from "node:crypto";
import { z } from "zod";
import type { Role } from "@jornada/shared";
import { one, q, tx } from "../db";
import { hashPassword } from "../crypto";
import { HttpError, forbidden, notFound } from "../errors";
import { audit } from "./audit";

/** Gestão de usuários do app (papel "user") pelo CMS. Só administradores. Toda ação vai para a auditoria (sem e-mail no log). */
type Actor = { id: string; role: Role };
const adminOnly = (a: Actor) => { if (a.role !== "admin") throw forbidden(); };

const email = z.string().trim().toLowerCase().email("E-mail inválido").max(254);
const displayName = z.string().trim().max(80).nullish();

/** Senha temporária legível (sem 0/O/1/l), 12 caracteres. Mostrada uma única vez no CMS. */
export function tempPassword() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 12 }, () => A[randomInt(A.length)]).join("");
}

async function target(id: string) {
  const u = await one<{ id: string; role: string }>("SELECT id, role FROM users WHERE id=$1", [z.string().uuid().parse(id)]);
  if (!u) throw notFound();
  if (u.role !== "user") throw new HttpError(409, "Esta conta faz parte da equipe. Gerencie-a em Equipe.");
  return u;
}

const listSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(["all", "active", "blocked", "pending"]).default("all"),
  page: z.coerce.number().int().min(0).max(10000).default(0),
});
export async function listAppUsers(a: Actor, input: z.input<typeof listSchema>) {
  adminOnly(a);
  const f = listSchema.parse(input); const size = 50;
  const where = ["u.role = 'user'"]; const args: unknown[] = [];
  if (f.q) { args.push(`%${f.q.toLowerCase()}%`); where.push(`(lower(u.email) LIKE $${args.length} OR lower(coalesce(u.display_name,'')) LIKE $${args.length})`); }
  if (f.status === "blocked") where.push("u.blocked_at IS NOT NULL");
  if (f.status === "active") where.push("u.blocked_at IS NULL");
  if (f.status === "pending") where.push("u.must_change_password");
  const w = where.join(" AND ");
  const [rows, total] = await Promise.all([
    q(`SELECT u.id, u.email, u.display_name AS "displayName", u.created_at AS "createdAt", u.blocked_at AS "blockedAt",
          u.must_change_password AS "mustChangePassword", (SELECT max(day)::text FROM user_activity_days d WHERE d.user_id=u.id) AS "lastActiveDay"
        FROM users u WHERE ${w} ORDER BY u.created_at DESC LIMIT ${size} OFFSET ${f.page * size}`, args),
    one<{ n: number }>(`SELECT count(*)::int AS n FROM users u WHERE ${w}`, args),
  ]);
  return { rows, total: total?.n ?? 0, page: f.page, pageSize: size };
}

/** Ficha da conta: dados cadastrais e só contagens de uso (nada do conteúdo das anotações). */
export async function getAppUser(a: Actor, id: string) {
  adminOnly(a); await target(id);
  return one(`SELECT u.id, u.email, u.display_name AS "displayName", u.created_at AS "createdAt", u.blocked_at AS "blockedAt",
      u.must_change_password AS "mustChangePassword",
      (SELECT max(day)::text FROM user_activity_days d WHERE d.user_id=u.id) AS "lastActiveDay",
      (SELECT count(*)::int FROM user_activity_days d WHERE d.user_id=u.id AND d.day > now()::date - 30) AS "activeDays30",
      (SELECT count(DISTINCT journey_id)::int FROM user_progress p WHERE p.user_id=u.id AND p.kind='step') AS "journeysStarted",
      (SELECT count(*)::int FROM user_progress p WHERE p.user_id=u.id) AS "itemsCompleted",
      (SELECT count(*)::int FROM private_notes n WHERE n.user_id=u.id) AS "notes",
      (SELECT count(*)::int FROM user_bookmarks b WHERE b.user_id=u.id) AS "bookmarks",
      (SELECT count(*)::int FROM devices v WHERE v.user_id=u.id) AS "devices"
    FROM users u WHERE u.id=$1`, [id]);
}

const createSchema = z.object({ email, displayName });
export async function createAppUser(a: Actor, input: z.input<typeof createSchema>) {
  adminOnly(a);
  const d = createSchema.parse(input);
  if (await one("SELECT 1 FROM users WHERE lower(email)=$1", [d.email])) throw new HttpError(409, "E-mail já cadastrado");
  const password = tempPassword(); const hash = await hashPassword(password);
  const id = await tx(async (c) => {
    const u = (await c.query("INSERT INTO users(email,password_hash,display_name,must_change_password) VALUES ($1,$2,$3,true) RETURNING id",
      [d.email, hash, d.displayName || null])).rows[0];
    await c.query("INSERT INTO user_preferences(user_id) VALUES ($1)", [u.id]);
    await c.query("INSERT INTO notification_preferences(user_id) VALUES ($1)", [u.id]);
    return u.id as string;
  });
  await audit(a.id, "app_user.create", "user", id);
  return { id, temporaryPassword: password };
}

const updateSchema = z.object({ email: email.optional(), displayName, blocked: z.boolean().optional() });
export async function updateAppUser(a: Actor, id: string, input: z.input<typeof updateSchema>) {
  adminOnly(a); await target(id);
  const d = updateSchema.parse(input);
  if (d.email && await one("SELECT 1 FROM users WHERE lower(email)=$1 AND id<>$2", [d.email, id])) throw new HttpError(409, "E-mail já cadastrado");
  await tx(async (c) => {
    if (d.email !== undefined) await c.query("UPDATE users SET email=$2 WHERE id=$1", [id, d.email]);
    if (d.displayName !== undefined) await c.query("UPDATE users SET display_name=$2 WHERE id=$1", [id, d.displayName || null]);
    if (d.blocked === true) {
      await c.query("UPDATE users SET blocked_at=coalesce(blocked_at, now()) WHERE id=$1", [id]);
      await c.query("DELETE FROM sessions WHERE user_id=$1", [id]); // desconecta todos os aparelhos
    }
    if (d.blocked === false) await c.query("UPDATE users SET blocked_at=NULL WHERE id=$1", [id]);
  });
  const fields = Object.keys(d).filter((k) => (d as any)[k] !== undefined);
  await audit(a.id, d.blocked === true ? "app_user.block" : d.blocked === false ? "app_user.unblock" : "app_user.update", "user", id, { fields });
}

export async function resetAppUserPassword(a: Actor, id: string) {
  adminOnly(a); await target(id);
  const password = tempPassword(); const hash = await hashPassword(password);
  await tx(async (c) => {
    await c.query("UPDATE users SET password_hash=$2, must_change_password=true WHERE id=$1", [id, hash]);
    await c.query("DELETE FROM sessions WHERE user_id=$1", [id]);
  });
  await audit(a.id, "app_user.password_reset", "user", id);
  return { temporaryPassword: password };
}

/** Exclusão definitiva: apaga a conta e, por cascata, todos os dados pessoais (igual à exclusão feita pela própria pessoa). */
export async function deleteAppUser(a: Actor, id: string) {
  adminOnly(a); await target(id);
  await audit(a.id, "app_user.delete", "user", id);
  await q("DELETE FROM users WHERE id=$1", [id]);
}
