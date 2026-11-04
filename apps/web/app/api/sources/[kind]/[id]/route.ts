import { z } from "zod";
import { api } from "@/lib/http";
import { contentSource } from "@/lib/services/user";
export const GET = api<{ kind: string; id: string }>(async (_r, { params }) =>
  contentSource(z.enum(["step", "reflection"]).parse(params.kind), z.string().uuid().parse(params.id)));
