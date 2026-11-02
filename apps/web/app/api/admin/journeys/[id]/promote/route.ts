import { api, body } from "@/lib/http";
import { promote, unpromote } from "@/lib/services/editorial";
export const POST = api<{ id: string }>(async (req, { user, params }) => { await promote(user, params.id, await body(req)); }, { auth: "staff" });
export const DELETE = api<{ id: string }>(async (_r, { user, params }) => { await unpromote(user, params.id); }, { auth: "staff" });
