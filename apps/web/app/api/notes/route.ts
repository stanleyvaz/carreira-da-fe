import { api, body } from "@/lib/http";
import { createNote, listNotes } from "@/lib/services/user";
export const GET = api(async (_r, { user }) => listNotes(user.id));
export const POST = api(async (req, { user }) => createNote(user.id, await body(req)));
