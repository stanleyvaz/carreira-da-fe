import { api } from "@/lib/http";
import { completeReflection } from "@/lib/services/user";
export const POST = api<{ id: string }>(async (_r, { user, params }) => { await completeReflection(user.id, params.id); });
