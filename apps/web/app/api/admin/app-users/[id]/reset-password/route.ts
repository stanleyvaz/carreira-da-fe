import { api } from "@/lib/http";
import { resetAppUserPassword } from "@/lib/services/appUsers";
export const POST = api<{ id: string }>(async (_r, { user, params }) => resetAppUserPassword(user, params.id), { auth: "staff" });
