import { api } from "@/lib/http";
import { dashboard } from "@/lib/services/editorial";
export const GET = api(async (_r, { user }) => dashboard(user), { auth: "staff" });
