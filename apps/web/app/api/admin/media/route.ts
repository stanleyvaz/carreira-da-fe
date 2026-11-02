import { api } from "@/lib/http";
import { storeImage, MAX_IMAGE } from "@/lib/media";
import { HttpError, forbidden } from "@/lib/errors";
/** Upload de imagem de conteúdo (corpo = bytes da imagem). */
export const POST = api(async (req, { user }) => {
  if (!["admin", "editor"].includes(user.role)) throw forbidden();
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length > MAX_IMAGE) throw new HttpError(413, "Imagem muito grande (máx. 3 MB)");
  return { id: await storeImage("content", null, buf) };
}, { auth: "staff", limit: { key: "media", max: 60 } });
