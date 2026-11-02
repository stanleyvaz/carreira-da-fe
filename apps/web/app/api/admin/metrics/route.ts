import { api } from "@/lib/http";
import { aggregateMetrics } from "@/lib/services/editorial";
export const GET = api(async (_r, { user }) => aggregateMetrics(user), { auth: "staff" });
