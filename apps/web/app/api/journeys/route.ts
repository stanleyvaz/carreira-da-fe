import { api } from "@/lib/http";
import { listJourneys } from "@/lib/services/user";
export const GET = api(async (req, { user }) => listJourneys(user.id, req.nextUrl.searchParams.get("topic") ?? undefined));
