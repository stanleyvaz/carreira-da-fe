import { api, body } from "@/lib/http";
import { setCompanion } from "@/lib/services/user";
/** Escolha do personagem (primeira abertura do app e Perfil). */
export const PUT = api(async (req, { user }) => setCompanion(user.id, await body(req)));
