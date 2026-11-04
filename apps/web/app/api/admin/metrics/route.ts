import { api } from "@/lib/http";
import { dashboard } from "@/lib/services/analytics";
export const GET = api(async (req, { user }) => dashboard(user, req.nextUrl.searchParams.get("days") ?? undefined), { auth: "staff" });
