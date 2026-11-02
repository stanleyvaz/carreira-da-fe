import { api } from "@/lib/http";
import { todayReflection } from "@/lib/services/user";
export const GET = api(async (_r, { user }) => (await todayReflection(user.id)) ?? { empty: true });
