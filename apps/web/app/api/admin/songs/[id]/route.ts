import { z } from "zod";
import { api, body } from "@/lib/http";
import { getSong, setSongCredits, setSongTopics } from "@/lib/services/editorial";
export const GET = api<{ id: string }>(async (_r, { user, params }) => getSong(user, params.id), { auth: "staff" });
export const PUT = api<{ id: string }>(async (req, { user, params }) => {
  const b = z.object({ credits: z.string().optional(), topicIds: z.array(z.string()).optional() }).parse(await body(req));
  if (b.credits !== undefined) await setSongCredits(user, params.id, b.credits);
  if (b.topicIds) await setSongTopics(user, params.id, b.topicIds);
}, { auth: "staff" });
