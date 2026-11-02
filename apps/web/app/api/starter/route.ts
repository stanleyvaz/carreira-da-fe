import { api } from "@/lib/http";
import { getStarter } from "@/lib/services/user";
export const GET = api(async (_r, { user }) => (await getStarter(user.id)) ?? { id: null });
