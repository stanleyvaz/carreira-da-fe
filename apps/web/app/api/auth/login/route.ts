import { api, body } from "@/lib/http";
import { login } from "@/lib/services/accounts";
import { createSession, setSessionCookie } from "@/lib/auth";
export const POST = api(async (req) => {
  const id = await login(await body(req));
  const s = await createSession(id);
  await setSessionCookie(s.token, s.expires);
  return { ok: true, token: s.token };
}, { auth: "none", limit: { key: "login", max: 10 } });
