import { api } from "@/lib/http";
import { one } from "@/lib/db";
import { notFound } from "@/lib/errors";
/** A foto do próprio usuário (atalho estável para <img>). */
export const GET = api(async (_r, { user }) => {
  const m = await one<{ mime: string; bytes: Buffer }>("SELECT m.mime,m.bytes FROM users u JOIN media m ON m.id=u.avatar_media_id WHERE u.id=$1", [user.id]);
  if (!m) throw notFound();
  return new Response(new Uint8Array(m.bytes), { headers: { "content-type": m.mime, "cache-control": "private, no-cache", "x-content-type-options": "nosniff" } });
});
