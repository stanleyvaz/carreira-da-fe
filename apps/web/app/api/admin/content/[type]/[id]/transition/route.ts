import { z } from "zod";
import { api, body } from "@/lib/http";
import { transition } from "@/lib/services/editorial";
export const POST = api<{ type: string; id: string }>(async (req, { user, params }) =>
  transition(user, z.enum(["journey", "reflection", "activity", "song", "resource"]).parse(params.type), z.string().uuid().parse(params.id), await body(req)), { auth: "staff" });
