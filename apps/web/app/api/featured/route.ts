import { api } from "@/lib/http";
import { getFeatured } from "@/lib/services/user";
export const GET = api(async (_r, { user }) => (await getFeatured(user.id)) ?? { none: true });
