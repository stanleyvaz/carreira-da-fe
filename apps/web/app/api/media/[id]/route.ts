import { z } from "zod";
import { api } from "@/lib/http";
import { one } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { ADMIN_ROLES } from "@jornada/shared";
/** Avatar: só o dono (ou equipe). Imagens de conteúdo: qualquer usuário autenticado. */
export const GET = api<{ id: string }>(async (_r, { user, params }) => {
  const m = await one<{ mime: string; bytes: Buffer; kind: string; owner_user_id: string | null }>("SELECT mime,bytes,kind,owner_user_id FROM media WHERE id=$1", [z.string().uuid().parse(params.id)]);
  if (!m || (m.kind === "avatar" && m.owner_user_id !== user.id && !ADMIN_ROLES.includes(user.role))) throw notFound();
  return new Response(new Uint8Array(m.bytes), { headers: { "content-type": m.mime, "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" } });
});
