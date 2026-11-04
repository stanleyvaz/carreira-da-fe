import { api } from "@/lib/http";
import { contentMetrics } from "@/lib/services/analytics";
export const GET = api(async (req, { user }) => contentMetrics(user, req.nextUrl.searchParams.get("days") ?? undefined), { auth: "staff" });
