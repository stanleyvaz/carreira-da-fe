import { z } from "zod";
import { api, body } from "@/lib/http";
import { setStarter } from "@/lib/services/editorial";
export const POST = api<{ id: string }>(async (req, { user, params }) => {
  const b = z.object({ on: z.boolean() }).parse(await body(req));
  await setStarter(user, z.string().uuid().parse(params.id), b.on);
}, { auth: "staff" });
