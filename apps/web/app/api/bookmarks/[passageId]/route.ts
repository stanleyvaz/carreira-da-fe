import { z } from "zod";
import { api } from "@/lib/http";
import { removeBookmark } from "@/lib/services/user";
export const DELETE = api<{ passageId: string }>(async (_r, { user, params }) => { await removeBookmark(user.id, z.string().uuid().parse(params.passageId)); });
