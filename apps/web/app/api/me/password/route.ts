import { api, body } from "@/lib/http";
import { currentToken } from "@/lib/auth";
import { changePassword } from "@/lib/services/accounts";
export const POST = api(async (req, { user }) => { await changePassword(user.id, await currentToken(), await body(req) as any); }, { limit: { key: "pwd", max: 10 } });
