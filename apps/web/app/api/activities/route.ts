import { api } from "@/lib/http";
import { listActivities } from "@/lib/services/user";
export const GET = api(async (_r, { user }) => listActivities(user.id));
