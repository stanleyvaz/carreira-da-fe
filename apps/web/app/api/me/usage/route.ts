import { z } from "zod";
import { api, body } from "@/lib/http";
import { AREAS, recordAreaTime } from "@/lib/services/usage";
const schema = z.object({ items: z.array(z.object({ area: z.enum(AREAS), seconds: z.number().min(0).max(86400) })).max(50) });
/** Tempo por área do app. Só é somado (de forma agregada, sem identificar a pessoa) se houver consentimento. */
export const POST = api(async (req, { user }) => recordAreaTime(user.id, schema.parse(await body(req)).items.filter((x) => x.seconds >= 1)),
  { limit: { key: "usage", max: 120 } });
