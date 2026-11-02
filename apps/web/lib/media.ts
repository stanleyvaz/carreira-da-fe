import { z } from "zod";
import { one } from "./db";
import { HttpError } from "./errors";
export const MAX_IMAGE = 3 * 1024 * 1024;
/** Detecta o tipo pelo conteúdo (não confia no Content-Type enviado). */
export function sniffImage(b: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 12 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length > 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}
export async function storeImage(kind: "avatar" | "content", ownerUserId: string | null, bytes: Buffer): Promise<string> {
  if (bytes.length > MAX_IMAGE) throw new HttpError(413, "Imagem muito grande (máx. 3 MB)");
  const mime = sniffImage(bytes);
  if (!mime) throw new HttpError(415, "Use uma imagem JPEG, PNG ou WebP");
  const r = await one<{ id: string }>("INSERT INTO media(kind,owner_user_id,mime,bytes) VALUES ($1,$2,$3,$4) RETURNING id", [kind, ownerUserId, mime, bytes]);
  return r!.id;
}
export const mediaId = z.string().uuid();
