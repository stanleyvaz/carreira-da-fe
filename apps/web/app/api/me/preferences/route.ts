import { api, body } from "@/lib/http";
import { getPreferences, savePreferences } from "@/lib/services/user";
export const GET = api(async (_r, { user }) => getPreferences(user.id));
export const PUT = api(async (req, { user }) => { await savePreferences(user.id, await body(req)); });
