import { cookies } from "next/headers";
import { api } from "@/lib/http";
import { SESSION_COOKIE, clearSessionCookie, destroySession } from "@/lib/auth";
export const POST = api(async () => {
  const t = (await cookies()).get(SESSION_COOKIE)?.value;
  if (t) await destroySession(t);
  await clearSessionCookie();
}, { auth: "none" });
