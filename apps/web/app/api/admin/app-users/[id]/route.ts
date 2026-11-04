import { api, body } from "@/lib/http";
import { deleteAppUser, getAppUser, updateAppUser } from "@/lib/services/appUsers";
export const GET = api<{ id: string }>(async (_r, { user, params }) => getAppUser(user, params.id), { auth: "staff" });
export const PATCH = api<{ id: string }>(async (req, { user, params }) => { await updateAppUser(user, params.id, await body(req)); }, { auth: "staff" });
export const DELETE = api<{ id: string }>(async (_r, { user, params }) => { await deleteAppUser(user, params.id); }, { auth: "staff" });
