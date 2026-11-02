/**
 * Importa conteúdo editorial (content/*.json) como EM REVISÃO (nunca publicado):
 * a aprovação e a publicação continuam sendo ações humanas no CMS.
 * Idempotente por título. Valida formato, referências bíblicas e gabaritos.
 * Uso: npm run import-content -w apps/web [-- --dry]
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { one, pool, q, tx } from "../lib/db";
import { lookupRef } from "../lib/services/bible";
import { stepsSchema } from "../lib/services/editorial";
process.loadEnvFile?.(".env.local");

const dry = process.argv.includes("--dry");
const dir = join(__dirname, "../content");
const ref = z.string().trim().min(5);
const journeyFile = z.object({
  topic: z.string(), title: z.string().min(3).max(140), summary: z.string().max(500).optional(),
  kind: z.enum(["journey", "challenge"]).default("journey"), days: z.number().int().min(3).max(40),
  steps: z.array(z.object({
    title: z.string(), passage: ref, context: z.string().optional(), explanation: z.string().optional(), application: z.string().optional(), extra: z.string().optional(),
    question: z.object({ prompt: z.string(), options: z.array(z.string()).min(2).max(6), correctIndex: z.number().int(), explanation: z.string().optional() }),
  })),
});
const reflectionFile = z.array(z.object({ topic: z.string().optional(), title: z.string().min(3), passage: ref, body: z.string().min(10), application: z.string().optional(), question: z.string().optional() }));
const activityFile = z.array(z.object({ topic: z.string().optional(), title: z.string().min(3), invitation: z.string().min(5) }));

async function main() {
  const topics = new Map((await q<{ id: string; slug: string }>("SELECT id,slug FROM topics")).map((t) => [t.slug, t.id]));
  const topic = (s?: string) => { if (!s) return null; const id = topics.get(s); if (!id) throw new Error(`Tema inexistente: ${s}`); return id; };
  const problems: string[] = [];
  let nj = 0, nr = 0, na = 0, skipped = 0;

  const journeys: z.infer<typeof journeyFile>[] = [];
  const jd = join(dir, "journeys");
  if (existsSync(jd)) for (const f of readdirSync(jd).filter((f) => f.endsWith(".json")).sort()) {
    try { journeys.push(journeyFile.parse(JSON.parse(readFileSync(join(jd, f), "utf8")))); } catch (e: any) { problems.push(`${f}: ${e.message?.slice(0, 300)}`); }
  }
  for (const j of journeys) {
    if (j.steps.length !== j.days) problems.push(`"${j.title}": days=${j.days} mas há ${j.steps.length} etapas`);
    for (const [i, s] of j.steps.entries()) {
      if (s.question.correctIndex < 0 || s.question.correctIndex >= s.question.options.length) problems.push(`"${j.title}" etapa ${i + 1}: gabarito fora das opções`);
      try { await lookupRef("ACF", s.passage); } catch (e: any) { problems.push(`"${j.title}" etapa ${i + 1}: ${e.message}`); }
    }
    try { topic(j.topic); } catch (e: any) { problems.push(`"${j.title}": ${e.message}`); }
  }
  // reflections.json vem primeiro; reflections-*.json são intercaladas (round-robin) para variar livros e temas ao longo do ano.
  const readList = <T,>(file: string, schema: z.ZodType<T[]>): T[] => { try { return schema.parse(JSON.parse(readFileSync(join(dir, file), "utf8"))); } catch (e: any) { problems.push(`${file}: ${e.message?.slice(0, 300)}`); return []; } };
  const files = existsSync(dir) ? readdirSync(dir) : [];
  const rf: z.infer<typeof reflectionFile> = files.includes("reflections.json") ? readList("reflections.json", reflectionFile) : [];
  const extra = files.filter((f) => /^reflections-.+\.json$/.test(f)).sort().map((f) => readList(f, reflectionFile));
  for (let i = 0; extra.some((l) => i < l.length); i++) for (const l of extra) if (i < l.length) rf.push(l[i]);
  const af: z.infer<typeof activityFile> = [];
  for (const f of files.filter((f) => /^activities(-.+)?\.json$/.test(f)).sort()) af.push(...readList(f, activityFile));
  const dup = (xs: string[], what: string) => { const seen = new Set<string>(); for (const x of xs) { if (seen.has(x.toLowerCase())) problems.push(`${what} duplicado: "${x}"`); seen.add(x.toLowerCase()); } };
  dup(rf.map((r) => r.title), "título de reflexão"); dup(af.map((a) => a.title), "título de exercício"); dup(journeys.map((j) => j.title), "título de jornada");
  for (const r of rf) { try { await lookupRef("ACF", r.passage); topic(r.topic); } catch (e: any) { problems.push(`reflexão "${r.title}": ${e.message}`); } }
  for (const a of af) { try { topic(a.topic); } catch (e: any) { problems.push(`atividade "${a.title}": ${e.message}`); } }
  if (problems.length) { console.error(`${problems.length} problema(s):\n- ` + problems.join("\n- ")); process.exit(1); }
  console.log(`Validado: ${journeys.length} jornadas, ${rf.length} reflexões, ${af.length} atividades.`);
  if (dry) return;

  const toReview = async (c: any, table: string, type: string, id: string) => {
    await c.query(`UPDATE ${table} SET status='in_review' WHERE id=$1`, [id]);
    const row = (await c.query(`SELECT * FROM ${table} WHERE id=$1`, [id])).rows[0];
    const data: any = { ...row };
    if (type === "journey") data.steps = (await c.query(`SELECT s.*, (SELECT json_agg(cq) FROM comprehension_questions cq WHERE cq.step_id=s.id) AS questions FROM journey_steps s WHERE journey_id=$1 ORDER BY position`, [id])).rows;
    await c.query(`INSERT INTO content_versions(content_type,content_id,version,snapshot) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [type, id, row.version, JSON.stringify(data)]);
    await c.query(`INSERT INTO audit_logs(action,entity,entity_id,detail) VALUES ($1,$2,$3,$4)`, [`${type}.import`, type, id, JSON.stringify({ source: "content/*.json", status: "in_review" })]);
  };
  await tx(async (c) => {
    for (const j of journeys) {
      if ((await c.query("SELECT 1 FROM learning_journeys WHERE title=$1", [j.title])).rowCount) { skipped++; continue; }
      const id = (await c.query(`INSERT INTO learning_journeys(topic_id,title,summary,days,kind) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [topic(j.topic), j.title, j.summary ?? null, j.days, j.kind])).rows[0].id;
      for (const [i, s] of j.steps.entries()) {
        const p = await lookupRef("ACF", s.passage);
        const sid = (await c.query(`INSERT INTO journey_steps(journey_id,position,title,passage_id,context,explanation,application,extra) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [id, i + 1, s.title, p.passageId, s.context ?? null, s.explanation ?? null, s.application ?? null, s.extra ?? null])).rows[0].id;
        await c.query(`INSERT INTO comprehension_questions(step_id,prompt,options,correct_index,explanation) VALUES ($1,$2,$3,$4,$5)`, [sid, s.question.prompt, s.question.options, s.question.correctIndex, s.question.explanation ?? null]);
      }
      await toReview(c, "learning_journeys", "journey", id); nj++;
    }
    // Datas contínuas: começam no dia seguinte à última reflexão já agendada (ou hoje).
    const last = (await c.query("SELECT max(publish_date)::text AS d FROM reflections")).rows[0].d as string | null;
    const base = last ? new Date(last + "T12:00:00Z").getTime() + 864e5 : Date.now();
    let k = 0;
    for (const r of rf) {
      if ((await c.query("SELECT 1 FROM reflections WHERE title=$1", [r.title])).rowCount) { skipped++; continue; }
      const p = await lookupRef("ACF", r.passage);
      const date = new Date(base + k++ * 864e5).toISOString().slice(0, 10);
      const id = (await c.query(`INSERT INTO reflections(topic_id,publish_date,passage_id,title,body,application,question) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [topic(r.topic), date, p.passageId, r.title, r.body, r.application ?? null, r.question ?? null])).rows[0].id;
      await toReview(c, "reflections", "reflection", id); nr++;
    }
    for (const a of af) {
      if ((await c.query("SELECT 1 FROM practical_activities WHERE title=$1", [a.title])).rowCount) { skipped++; continue; }
      const id = (await c.query(`INSERT INTO practical_activities(topic_id,title,invitation) VALUES ($1,$2,$3) RETURNING id`, [topic(a.topic), a.title, a.invitation])).rows[0].id;
      await toReview(c, "practical_activities", "activity", id); na++;
    }
  });
  console.log(`Importado EM REVISÃO: ${nj} jornadas, ${nr} reflexões, ${na} atividades (${skipped} já existiam). Aprove e publique no CMS.`);
}
main().then(() => pool().end()).catch((e) => { console.error(e); process.exit(1); });
void one;
