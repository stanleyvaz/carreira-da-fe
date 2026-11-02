import { api, body } from "@/lib/http";
import { createNotification, listNotifications } from "@/lib/services/notifications";
export const GET = api(async (_r, { user }) => listNotifications(user), { auth: "staff" });
export const POST = api(async (req, { user }) => ({ id: await createNotification(user, await body(req) as any) }), { auth: "staff" });
