import { api, body } from "@/lib/http";
import { setJourneySteps } from "@/lib/services/editorial";
export const PUT = api<{ id: string }>(async (req, { user, params }) => { await setJourneySteps(user, params.id, await body(req)); }, { auth: "staff" });
