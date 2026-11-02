import { z } from "zod";
import { api, body } from "@/lib/http";
import * as ed from "@/lib/services/editorial";
const T = z.enum(["journey", "reflection", "activity", "song", "resource"]);
const ID = z.string().uuid();
export const GET = api<{ type: string; id: string }>(async (_r, { user, params }) => params.type === "resource" ? ed.getResource(user, ID.parse(params.id)) : ed.getContent(user, T.parse(params.type), ID.parse(params.id)), { auth: "staff" });
export const PUT = api<{ type: string; id: string }>(async (req, { user, params }) => { params.type === "resource" ? await ed.updateResource(user, ID.parse(params.id), await body(req) as any) : await ed.updateContent(user, T.parse(params.type), ID.parse(params.id), await body(req)); }, { auth: "staff" });
export const DELETE = api<{ type: string; id: string }>(async (_r, { user, params }) => { await ed.deleteDraft(user, T.parse(params.type), ID.parse(params.id)); }, { auth: "staff" });
