import { z } from "zod";
import { api, body } from "@/lib/http";
import { analyticsConsent, setAnalyticsConsent } from "@/lib/services/usage";
/** Consentimento para estatísticas de uso anônimas (opt-in; pode ser retirado a qualquer momento). */
export const GET = api(async (_r, { user }) => ({ aggregateAnalytics: await analyticsConsent(user.id) }));
export const PUT = api(async (req, { user }) => {
  const d = z.object({ aggregateAnalytics: z.boolean() }).parse(await body(req));
  await setAnalyticsConsent(user.id, d.aggregateAnalytics);
  return { aggregateAnalytics: d.aggregateAnalytics };
});
