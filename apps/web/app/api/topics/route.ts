import { api } from "@/lib/http";
import { listTopics } from "@/lib/services/user";
export const GET = api(async () => listTopics());
