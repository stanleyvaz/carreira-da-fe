import { api, body } from "@/lib/http";
import { completeStep } from "@/lib/services/user";
export const POST = api<{ id: string }>(async (req, { user, params }) => completeStep(user.id, params.id, await body(req)));
