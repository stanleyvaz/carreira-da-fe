import { api, body } from "@/lib/http";
import { listTopicsAdmin, saveTopic } from "@/lib/services/editorial";
export const GET = api(async () => listTopicsAdmin(), { auth: "staff" });
export const POST = api(async (req, { user }) => ({ id: await saveTopic(user, await body(req) as any) }), { auth: "staff" });
