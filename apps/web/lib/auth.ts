import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { ADMIN_ROLES, type Role } from "@jornada/shared";
import { one, q } from "./db";
import { sha256 } from "./crypto";
import { forbidden, unauthorized } from "./errors";

export const SESSION_COOKIE = "jornada_session";
const TTL_DAYS = 30;
export type SessionUser = { id: string; email: string; displayName: string | null; role: Role; hasAvatar?: boolean; mustChangePassword?: boolean };

export async function createSession(userId: string): Promise<{ token: string; expires: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + TTL_DAYS * 864e5);
  await q("INSERT INTO sessions(id_hash,user_id,expires_at) VALUES ($1,$2,$3)", [sha256(token), userId, expires]);
  return { token, expires };
}
export async function userFromToken(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  return one<SessionUser>(
    `SELECT u.id, u.email, u.display_name AS "displayName", u.role, u.avatar_media_id IS NOT NULL AS "hasAvatar", u.must_change_password AS "mustChangePassword"
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id_hash = $1 AND s.expires_at > now() AND u.blocked_at IS NULL`,
    [sha256(token)],
  );
}
export async function destroySession(token: string) {
  await q("DELETE FROM sessions WHERE id_hash=$1", [sha256(token)]);
}
export async function currentToken(): Promise<string | undefined> {
  const bearer = (await headers()).get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  return bearer ?? (await cookies()).get(SESSION_COOKIE)?.value;
}
export async function currentUser(): Promise<SessionUser | null> {
  // Cookie (web) ou Authorization: Bearer (apps móveis)
  const bearer = (await headers()).get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  return userFromToken(bearer ?? (await cookies()).get(SESSION_COOKIE)?.value);
}
export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) throw unauthorized();
  return u;
}
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) throw forbidden();
  return u;
}
export async function requireStaff(): Promise<SessionUser> {
  return requireRole(...ADMIN_ROLES);
}
export async function setSessionCookie(token: string, expires: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires,
  });
}
export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}
