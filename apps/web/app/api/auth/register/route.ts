import { api, body } from "@/lib/http";
import { register } from "@/lib/services/accounts";
import { createSession, setSessionCookie } from "@/lib/auth";
export const POST = api(async (req) => {
  const id = await register(await body(req));
  const s = await createSession(id);
  await setSessionCookie(s.token, s.expires);
  return { ok: true, token: s.token };
}, { auth: "none", limit: { key: "register", max: 10 } });
