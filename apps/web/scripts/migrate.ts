import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { poolOptions } from "../lib/db";

export async function migrate(url: string) {
  const pool = new Pool(poolOptions(url));
  const dir = join(__dirname, "../../../db/migrations");
  await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())");
  const done = new Set((await pool.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(f)) continue;
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query(readFileSync(join(dir, f), "utf8"));
      await c.query("INSERT INTO schema_migrations(name) VALUES ($1)", [f]);
      await c.query("COMMIT");
      console.log("applied", f);
    } catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
  }
  await pool.end();
}

if (require.main === module) {
  process.loadEnvFile?.(".env.local");
  migrate(process.env.DATABASE_URL!).catch((e) => { console.error(e); process.exit(1); });
}
