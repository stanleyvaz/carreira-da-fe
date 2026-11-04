import { api, body } from "@/lib/http";
import { createPhrase, listPhrases } from "@/lib/services/companion";
export const GET = api(async (_r, { user }) => listPhrases(user), { auth: "staff" });
export const POST = api(async (req, { user }) => createPhrase(user, await body(req)), { auth: "staff" });
