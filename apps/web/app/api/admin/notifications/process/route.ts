import { api } from "@/lib/http";
import { processOutbox } from "@/lib/services/notifications";
import { forbidden } from "@/lib/errors";
export const POST = api(async (_r, { user }) => { if (!["admin", "publisher"].includes(user.role)) throw forbidden(); return processOutbox(); }, { auth: "staff" });
