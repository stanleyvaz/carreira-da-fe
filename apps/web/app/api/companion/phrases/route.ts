import { api } from "@/lib/http";
import { enabledPhrases } from "@/lib/services/companion";
export const GET = api(async () => enabledPhrases());
