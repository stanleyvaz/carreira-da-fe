import { z } from "zod";
import { api, body } from "@/lib/http";
import { deleteNotification, previewRecipients, updateNotification } from "@/lib/services/notifications";
const ID = z.string().uuid();
export const GET = api<{ id: string }>(async (_r, { user, params }) => previewRecipients(user, ID.parse(params.id)), { auth: "staff" });
export const PUT = api<{ id: string }>(async (req, { user, params }) => { await updateNotification(user, ID.parse(params.id), await body(req) as any); }, { auth: "staff" });
export const DELETE = api<{ id: string }>(async (_r, { user, params }) => { await deleteNotification(user, ID.parse(params.id)); }, { auth: "staff" });
