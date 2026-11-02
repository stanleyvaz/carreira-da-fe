import { api, body } from "@/lib/http";
import { updateProfile } from "@/lib/services/accounts";
export const PUT = api(async (req, { user }) => { await updateProfile(user.id, await body(req) as any); });
