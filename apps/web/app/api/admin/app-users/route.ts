import { api, body } from "@/lib/http";
import { createAppUser, listAppUsers } from "@/lib/services/appUsers";
export const GET = api(async (req, { user }) => {
  const p = req.nextUrl.searchParams;
  return listAppUsers(user, { q: p.get("q") ?? undefined, status: (p.get("status") ?? undefined) as any, page: p.get("page") ? Number(p.get("page")) : undefined });
}, { auth: "staff" });
export const POST = api(async (req, { user }) => createAppUser(user, await body(req)), { auth: "staff" });
