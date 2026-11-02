import { api } from "@/lib/http";
import { deleteAccount } from "@/lib/services/accounts";
import { clearSessionCookie } from "@/lib/auth";
export const GET = api(async (_r, { user }) => user);
export const DELETE = api(async (_r, { user }) => { await deleteAccount(user.id); await clearSessionCookie(); });
