import { z } from "zod";
import { api, body } from "@/lib/http";
import { listBookmarks, toggleBookmark } from "@/lib/services/user";
export const GET = api(async (_r, { user }) => listBookmarks(user.id));
export const POST = api(async (req, { user }) => toggleBookmark(user.id, z.object({ passageId: z.string().uuid() }).parse(await body(req)).passageId));
