import { api } from "@/lib/http";
import { journeyFunnel } from "@/lib/services/analytics";
export const GET = api<{ id: string }>(async (req, { user, params }) => journeyFunnel(user, params.id, req.nextUrl.searchParams.get("days") ?? undefined), { auth: "staff" });
