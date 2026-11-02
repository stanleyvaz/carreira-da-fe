import { z } from "zod";
import { api, body } from "@/lib/http";
import { registerDevice, unregisterDevice } from "@/lib/services/notifications";
export const POST = api(async (req, { user }) => { await registerDevice(user.id, await body(req) as any); }, { limit: { key: "device", max: 30 } });
export const DELETE = api(async (req, { user }) => { await unregisterDevice(user.id, z.object({ token: z.string() }).parse(await body(req)).token); });
