/**
 * Importa indicações externas (content/resources.json) como EM REVISÃO.
 * Só metadados + link; temas e públicos vêm da curadoria por título; o revisor confere no CMS antes de aprovar.
 * Idempotente por URL. Uso: npm run import-resources -w apps/web
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { AUDIENCES, RESOURCE_KINDS } from "@jornada/shared";
import { one, pool, q, tx } from "../lib/db";
process.loadEnvFile?.(".env.local");
const file = z.array(z.object({
  kind: z.enum(RESOURCE_KINDS), source: z.string(), title: z.string().min(3).max(200),
  url: z.string().url().refine((u) => { const x = new URL(u); return x.protocol === "https:" && /(^|\.)universal\.org$/.test(x.hostname); }, "só https universal.org"),
  blurb: z.string().max(240), audiences: z.array(z.enum(AUDIENCES)).min(1), topics: z.array(z.string()).min(1),
  publishedOn: z.string().nullable().optional(),
}));
async function main() {
  const items = file.parse(JSON.parse(readFileSync(join(__dirname, "../content/resources.json"), "utf8")));
  const topics = new Map((await q<{ id: string; slug: string }>("SELECT id,slug FROM topics")).map((t) => [t.slug, t.id]));
  let added = 0;
  for (const it of items) {
    if (await one("SELECT 1 FROM resources WHERE url=$1", [it.url])) continue;
    for (const t of it.topics) if (!topics.has(t)) throw new Error(`Tema inexistente: ${t}`);
    await tx(async (c) => {
      const r = await c.query(`INSERT INTO resources(kind,source,title,url,blurb,published_on,audiences,status) VALUES ($1,$2,$3,$4,$5,$6,$7,'in_review') RETURNING id`,
        [it.kind, it.source, it.title, it.url, it.blurb, it.publishedOn ?? null, it.audiences]);
      for (const t of it.topics) await c.query("INSERT INTO resource_topics(resource_id,topic_id,suggested) VALUES ($1,$2,false)", [r.rows[0].id, topics.get(t)]);
    });
    added++;
  }
  console.log(`${added} indicações importadas em revisão (${items.length - added} já existiam).`);
}
main().then(() => pool().end()).catch((e) => { console.error(e); process.exit(1); });
