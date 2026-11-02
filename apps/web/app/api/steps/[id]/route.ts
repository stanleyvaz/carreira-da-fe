import { api } from "@/lib/http";
import { getStep } from "@/lib/services/user";
export const GET = api<{ id: string }>(async (_r, { user, params }) => getStep(user.id, params.id));
