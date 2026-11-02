import { z } from "zod";
import { api, body } from "@/lib/http";
import { sendNotification, sendTest } from "@/lib/services/notifications";
export const POST = api<{ id: string }>(async (req, { user, params }) => {
  const id = z.string().uuid().parse(params.id); const b: any = await body(req).catch(() => ({}));
  return b?.test ? sendTest(user, id) : sendNotification(user, id);
}, { auth: "staff", limit: { key: "notif-send", max: 20 } });
