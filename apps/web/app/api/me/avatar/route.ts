import { api } from "@/lib/http";
import { removeAvatar, setAvatar } from "@/lib/services/accounts";
import { MAX_IMAGE } from "@/lib/media";
import { HttpError } from "@/lib/errors";
export const PUT = api(async (req, { user }) => {
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length > MAX_IMAGE) throw new HttpError(413, "Imagem muito grande (máx. 3 MB)");
  await setAvatar(user.id, buf);
}, { limit: { key: "avatar", max: 20 } });
export const DELETE = api(async (_r, { user }) => { await removeAvatar(user.id); });
