import { api, body } from "@/lib/http";
import { login } from "@/lib/services/accounts";
import { createSession, setSessionCookie, userFromToken } from "@/lib/auth";
export const POST = api(async (req) => {
  const id = await login(await body(req));
  const s = await createSession(id);
  await setSessionCookie(s.token, s.expires);
  const u = await userFromToken(s.token);
  return { ok: true, token: s.token, mustChangePassword: !!u?.mustChangePassword };
}, { auth: "none", limit: { key: "login", max: 10 } });
