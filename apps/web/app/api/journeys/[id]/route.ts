import { api } from "@/lib/http";
import { getJourney } from "@/lib/services/user";
export const GET = api<{ id: string }>(async (_r, { user, params }) => getJourney(user.id, params.id));
