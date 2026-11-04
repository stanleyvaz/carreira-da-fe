import { api, body } from "@/lib/http";
import { deletePhrase, updatePhrase } from "@/lib/services/companion";
export const PATCH = api<{ id: string }>(async (req, { user, params }) => { await updatePhrase(user, params.id, await body(req)); }, { auth: "staff" });
export const DELETE = api<{ id: string }>(async (_r, { user, params }) => { await deletePhrase(user, params.id); }, { auth: "staff" });
