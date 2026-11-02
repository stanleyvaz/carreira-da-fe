import { z } from "zod";
import { api, body } from "@/lib/http";
import { HttpError } from "@/lib/errors";
import * as ed from "@/lib/services/editorial";
const type = z.enum(["journey", "reflection", "activity", "song", "resource"]);
export const GET = api(async (req, { user }) => {
  const p = req.nextUrl.searchParams;
  return ed.listContent(user, type.parse(p.get("type")), { status: p.get("status") ?? undefined, topic: p.get("topic") ?? undefined, q: p.get("q") ?? undefined });
}, { auth: "staff" });
export const POST = api(async (req, { user }) => {
  const b: any = await body(req);
  const t = type.parse(b.type);
  if (t === "song") throw new HttpError(400, "Músicas são importadas; use import-music");
  const id = t === "resource" ? await ed.createResource(user, b.data) : t === "journey" ? await ed.createJourney(user, b.data) : t === "reflection" ? await ed.createReflection(user, b.data) : await ed.createActivity(user, b.data);
  return { id };
}, { auth: "staff" });
