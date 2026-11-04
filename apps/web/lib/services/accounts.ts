import { z } from "zod";
import { registerSchema, credentialsSchema, passwordSchema } from "@jornada/shared";
import { one, q, tx } from "../db";
import { hashPassword, verifyPassword } from "../crypto";
import { HttpError } from "../errors";
import { audit } from "./audit";
import { decrypt, sha256 } from "../crypto";
import { storeImage } from "../media";

export async function register(input: z.input<typeof registerSchema>) {
  const d = registerSchema.parse(input);
  if (await one("SELECT 1 FROM users WHERE lower(email)=$1", [d.email])) throw new HttpError(409, "E-mail já cadastrado");
  const hash = await hashPassword(d.password);
  return tx(async (c) => {
    const u = (await c.query(
      "INSERT INTO users(email,password_hash,display_name) VALUES ($1,$2,$3) RETURNING id", [d.email, hash, d.displayName ?? null])).rows[0];
    await c.query("INSERT INTO user_preferences(user_id) VALUES ($1)", [u.id]);
    await c.query("INSERT INTO notification_preferences(user_id) VALUES ($1)", [u.id]);
    for (const p of ["terms", "privacy"])
      await c.query("INSERT INTO user_consents(user_id,purpose,granted) VALUES ($1,$2,true)", [u.id, p]);
    return u.id as string;
  });
}
export async function login(input: z.input<typeof credentialsSchema>) {
  const d = credentialsSchema.parse(input);
  const u = await one<{ id: string; password_hash: string; blocked: boolean }>("SELECT id,password_hash,blocked_at IS NOT NULL AS blocked FROM users WHERE lower(email)=$1", [d.email]);
  // Mesmo custo de verificação mesmo quando o usuário não existe (reduz enumeração por tempo).
  const ok = await verifyPassword(d.password, u?.password_hash ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==");
  if (!u || !ok) throw new HttpError(401, "E-mail ou senha inválidos");
  if (u.blocked) throw new HttpError(403, "Esta conta está bloqueada. Fale com o suporte do Carreira da Fé.", "account_blocked");
  return u.id;
}
/** Exclusão de conta: remove usuário e, por cascata, todos os dados pessoais. */
export async function deleteAccount(userId: string) {
  await audit(userId, "account.delete", "user", userId);
  await q("DELETE FROM users WHERE id=$1", [userId]);
}
/** Exportação (LGPD art. 18): todos os dados pessoais do titular; notas decifradas. */
export async function exportData(userId: string) {
  const [user, prefs, consents, progress, bookmarks, notes] = await Promise.all([
    one("SELECT id,email,display_name,role,created_at FROM users WHERE id=$1", [userId]),
    one("SELECT * FROM user_preferences WHERE user_id=$1", [userId]),
    q("SELECT purpose,granted,created_at FROM user_consents WHERE user_id=$1", [userId]),
    q("SELECT kind,ref_id,journey_id,answer_index,completed_at FROM user_progress WHERE user_id=$1", [userId]),
    q("SELECT passage_id,created_at FROM user_bookmarks WHERE user_id=$1", [userId]),
    q("SELECT id,ref_kind,ref_id,body_enc,created_at,updated_at FROM private_notes WHERE user_id=$1", [userId]),
  ]);
  return {
    exportedAt: new Date().toISOString(), user, preferences: prefs, consents, progress, bookmarks,
    notes: notes.map(({ body_enc, ...n }) => ({ ...n, body: decrypt(body_enc) })),
  };
}

export async function updateProfile(userId: string, input: { displayName?: string | null }) {
  const d = z.object({ displayName: z.string().trim().max(80).nullish() }).parse(input);
  await q("UPDATE users SET display_name=$2 WHERE id=$1", [userId, d.displayName || null]);
}
/** Troca de senha: exige a senha atual e encerra as demais sessões (mantém a atual). */
export async function changePassword(userId: string, currentToken: string | undefined, input: { currentPassword: string; newPassword: string }) {
  const d = z.object({ currentPassword: z.string().min(1).max(200), newPassword: passwordSchema }).parse(input);
  const u = await one<{ password_hash: string }>("SELECT password_hash FROM users WHERE id=$1", [userId]);
  if (!u || !(await verifyPassword(d.currentPassword, u.password_hash))) throw new HttpError(403, "Senha atual incorreta");
  if (d.currentPassword === d.newPassword) throw new HttpError(422, "A nova senha precisa ser diferente da atual");
  const hash = await hashPassword(d.newPassword);
  await tx(async (c) => {
    await c.query("UPDATE users SET password_hash=$2, must_change_password=false WHERE id=$1", [userId, hash]);
    await c.query("DELETE FROM sessions WHERE user_id=$1 AND ($2::text IS NULL OR id_hash<>$2)", [userId, currentToken ? sha256(currentToken) : null]);
  });
  await audit(userId, "account.password.change", "user", userId);
}
export async function setAvatar(userId: string, bytes: Buffer) {
  const id = await storeImage("avatar", userId, bytes);
  await tx(async (c) => {
    const old = (await c.query("SELECT avatar_media_id FROM users WHERE id=$1", [userId])).rows[0]?.avatar_media_id;
    await c.query("UPDATE users SET avatar_media_id=$2 WHERE id=$1", [userId, id]);
    if (old) await c.query("DELETE FROM media WHERE id=$1", [old]);
  });
}
export async function removeAvatar(userId: string) {
  await q("DELETE FROM media WHERE id=(SELECT avatar_media_id FROM users WHERE id=$1)", [userId]);
}
