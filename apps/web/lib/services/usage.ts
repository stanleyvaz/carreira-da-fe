import { one, q } from "../db";
import { geoOf } from "../geo";

/** Data de hoje no fuso de Brasília (o "dia" das métricas). */
export const TODAY = "(now() AT TIME ZONE 'America/Sao_Paulo')::date";

// Evita gravar a mesma atividade a cada requisição: cache do dia em memória.
const seen = new Set<string>(); let seenDay = "";

/**
 * Registra que a pessoa usou o app hoje (só a data) e, na primeira vez do dia,
 * soma 1 ao agregado de país/UF — sem ligar a localização à pessoa e sem guardar o IP.
 * Nunca derruba a requisição.
 */
export async function trackActivity(userId: string, ip: string | null | undefined) {
  try {
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    if (day !== seenDay) { seen.clear(); seenDay = day; }
    if (seen.has(userId)) return;
    seen.add(userId);
    const fresh = await one(`INSERT INTO user_activity_days(user_id, day) VALUES ($1, ${TODAY}) ON CONFLICT DO NOTHING RETURNING 1 AS ok`, [userId]);
    if (!fresh) return;
    const g = await geoOf(ip);
    await q(`INSERT INTO geo_daily(day, country, region, users) VALUES (${TODAY}, $1, $2, 1)
             ON CONFLICT (day, country, region) DO UPDATE SET users = geo_daily.users + 1`, [g.country, g.region]);
  } catch (e) { console.error("trackActivity", e); }
}

/** Conta uma abertura de conteúdo (agregado diário, sem usuário). */
export async function trackOpen(kind: "journey" | "step" | "resource", contentId: string) {
  try {
    await q(`INSERT INTO content_daily(day, kind, content_id, opens) VALUES (${TODAY}, $1, $2, 1)
             ON CONFLICT (day, kind, content_id) DO UPDATE SET opens = content_daily.opens + 1`, [kind, contentId]);
  } catch (e) { console.error("trackOpen", e); }
}

export const AREAS = ["hoje", "aprender", "exercitar", "minha", "favoritos", "perfil"] as const;

/** Consentimento vigente para estatísticas de uso (último registro vale). */
export async function analyticsConsent(userId: string): Promise<boolean> {
  const r = await one<{ granted: boolean }>(
    "SELECT granted FROM user_consents WHERE user_id=$1 AND purpose='aggregate_analytics' ORDER BY created_at DESC LIMIT 1", [userId]);
  return r?.granted ?? false;
}
export async function setAnalyticsConsent(userId: string, granted: boolean) {
  await q("INSERT INTO user_consents(user_id,purpose,granted) VALUES ($1,'aggregate_analytics',$2)", [userId, granted]);
}

/** Tempo por área enviado pelo app. Só soma se houver consentimento; grava só o agregado do dia. */
export async function recordAreaTime(userId: string, items: { area: (typeof AREAS)[number]; seconds: number }[]) {
  if (!(await analyticsConsent(userId))) return { recorded: 0 };
  for (const it of items) {
    const s = Math.max(1, Math.min(3600, Math.round(it.seconds)));
    await q(`INSERT INTO area_time_daily(day, area, visits, seconds) VALUES (${TODAY}, $1, 1, $2)
             ON CONFLICT (day, area) DO UPDATE SET visits = area_time_daily.visits + 1, seconds = area_time_daily.seconds + EXCLUDED.seconds`, [it.area, s]);
  }
  return { recorded: items.length };
}
