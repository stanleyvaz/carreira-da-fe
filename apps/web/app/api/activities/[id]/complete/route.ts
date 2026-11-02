import { api } from "@/lib/http";
import { completeActivity } from "@/lib/services/user";
export const POST = api<{ id: string }>(async (_r, { user, params }) => { await completeActivity(user.id, params.id); });
