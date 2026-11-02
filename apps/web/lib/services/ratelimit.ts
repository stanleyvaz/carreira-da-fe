import { one } from "../db";
import { HttpError } from "../errors";
/** Janela fixa de 1 min por chave (ex.: "login:ip"). Lança 429 ao exceder. */
export async function rateLimit(key: string, max: number) {
  const row = await one<{ count: number }>(
    `INSERT INTO rate_limits(key, window_start) VALUES ($1, date_trunc('minute', now()))
     ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
     RETURNING count`, [key]);
  if (row && row.count > max) throw new HttpError(429, "Muitas tentativas. Aguarde um instante.");
}
