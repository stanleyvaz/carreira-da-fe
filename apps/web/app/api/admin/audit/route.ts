import { api } from "@/lib/http";
import { auditLog } from "@/lib/services/editorial";
export const GET = api(async (_r, { user }) => auditLog(user), { auth: "staff" });
