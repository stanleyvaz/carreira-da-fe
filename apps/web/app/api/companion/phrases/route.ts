import { api } from "@/lib/http";
import { enabledPhrases } from "@/lib/services/companion";
/** `?animal=lion` junta as frases gerais e as do animal escolhido. */
export const GET = api(async (req) => enabledPhrases(req.nextUrl.searchParams.get("animal")));
