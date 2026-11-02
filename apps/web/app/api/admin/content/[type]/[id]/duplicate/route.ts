import { z } from "zod";
import { api } from "@/lib/http";
import { duplicate } from "@/lib/services/editorial";
export const POST = api<{ type: string; id: string }>(async (_r, { user, params }) =>
  ({ id: await duplicate(user, z.enum(["journey", "reflection", "activity"]).parse(params.type), z.string().uuid().parse(params.id)) }), { auth: "staff" });
