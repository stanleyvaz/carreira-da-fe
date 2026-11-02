import { z } from "zod";
import { api, body } from "@/lib/http";
import { bulkTransition } from "@/lib/services/editorial";
import { CONTENT_STATUS } from "@jornada/shared";
export const POST = api(async (req, { user }) => {
  const b = z.object({ type: z.enum(["journey", "reflection", "activity", "song", "resource"]), ids: z.array(z.string()), to: z.enum(CONTENT_STATUS), comment: z.string().optional() }).parse(await body(req));
  return bulkTransition(user, b.type, b.ids, b.to, b.comment);
}, { auth: "staff" });
