import { z } from "zod";
import { AUDIENCES } from "@jornada/shared";
import { api } from "@/lib/http";
import { listResources } from "@/lib/services/user";
export const GET = api(async (req) => {
  const p = req.nextUrl.searchParams;
  const f = z.object({ topic: z.string().max(60).optional(), audience: z.enum(AUDIENCES).optional(), limit: z.coerce.number().int().optional() })
    .parse({ topic: p.get("topic") ?? undefined, audience: p.get("audience") ?? undefined, limit: p.get("limit") ?? undefined });
  return listResources(f);
}, { auth: "user" });
