import { api } from "@/lib/http";
import { exportData } from "@/lib/services/accounts";
export const GET = api(async (_r, { user }) => exportData(user.id));
