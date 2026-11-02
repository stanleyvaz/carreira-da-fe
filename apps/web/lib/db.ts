import { Pool, type PoolConfig, type PoolClient, type QueryResultRow } from "pg";
import { SUPABASE_CA } from "./supabaseCa";

const g = globalThis as unknown as { __pool?: Pool };
/** Opções do pool. Hosts do Supabase: TLS verificado com a CA do Supabase (sem desligar a verificação). */
export function poolOptions(url: string): PoolConfig {
  const u = new URL(url); const sb = /supabase\.(com|co)$/.test(u.hostname);
  if (sb) u.searchParams.delete("sslmode");
  return { connectionString: u.toString(), max: sb ? 3 : 10, ...(sb ? { ssl: { ca: SUPABASE_CA, rejectUnauthorized: true } } : {}) };
}
export function pool(): Pool {
  if (!g.__pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL não configurada");
    g.__pool = new Pool(poolOptions(url));
  }
  return g.__pool;
}
export async function q<T extends QueryResultRow = any>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await pool().query<T>(text, params)).rows;
}
export async function one<T extends QueryResultRow = any>(text: string, params: unknown[] = []): Promise<T | null> {
  return (await q<T>(text, params))[0] ?? null;
}
export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query("BEGIN");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
}
