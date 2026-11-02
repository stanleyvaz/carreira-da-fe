import { z } from "zod";
import { api, body } from "@/lib/http";
import { deleteNote, updateNote } from "@/lib/services/user";
export const PUT = api<{ id: string }>(async (req, { user, params }) => { await updateNote(user.id, params.id, z.object({ body: z.string() }).parse(await body(req)).body); });
export const DELETE = api<{ id: string }>(async (_r, { user, params }) => { await deleteNote(user.id, params.id); });
