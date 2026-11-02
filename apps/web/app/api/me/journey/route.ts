import { api } from "@/lib/http";
import { myJourney } from "@/lib/services/user";
export const GET = api(async (_r, { user }) => myJourney(user.id));
