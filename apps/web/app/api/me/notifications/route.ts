import { api, body } from "@/lib/http";
import { getSettings, inbox, markRead, saveSettings } from "@/lib/services/notifications";
export const GET = api(async (_r, { user }) => ({ settings: await getSettings(user.id), inbox: await inbox(user.id) }));
export const PUT = api(async (req, { user }) => { await saveSettings(user.id, await body(req) as any); });
export const POST = api(async (req, { user }) => { const b: any = await body(req); await markRead(user.id, b?.id); });
