import { z } from "zod";
import { api, body } from "@/lib/http";
import { listStaff, setRoleByEmail } from "@/lib/services/editorial";
export const GET = api(async (_r, { user }) => listStaff(user), { auth: "staff" });
export const PUT = api(async (req, { user }) => { const b = z.object({ email: z.string().email(), role: z.string() }).parse(await body(req)); await setRoleByEmail(user, b.email, b.role); }, { auth: "staff" });
