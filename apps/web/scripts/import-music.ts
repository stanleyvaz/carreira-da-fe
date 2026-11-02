/**
 * Importa letras (.txt) como RASCUNHOS, com temas sugeridos por palavras-chave (revisão humana obrigatória).
 * Uso: npm run import-music -w apps/web -- ../../music
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pool, q, tx } from "../lib/db";
process.loadEnvFile?.(".env.local");

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const KEYWORDS: Record<string, string[]> = {
  fe: ["fe ", "crer", "creio", "acredit"], oracao: ["oracao", "orar", "ora ", "clamor", "clamar"], perdao: ["perdao", "perdoar", "perdoa", "misericordia"],
  familia: ["familia", "filhos", "lar ", "pai e mae"], casamento: ["casamento", "esposa", "esposo", "casal", "noiva"],
  relacionamentos: ["amigo", "amizade", "irmao", "proximo"], trabalho: ["trabalho", "trabalhar", "emprego"],
  sabedoria: ["sabedoria", "sabio", "entendimento"], "dominio-proprio": ["dominio proprio", "tentacao", "vigiai", "vigiar"],
  honestidade: ["honestidade", "verdade", "mentira", "integridade"], generosidade: ["generos", "dar ", "ofertar", "repartir", "compartilh"],
  perseveranca: ["perseveran", "persistir", "nao desista", "resistir", "firme"], "ensinamentos-de-jesus": ["jesus", "mestre", "sermao", "parabola"],
  "personagens-biblicos": ["davi", "moises", "daniel", "jose ", "abraao", "lazaro", "paulo", "elias", "ester"],
};
async function main() {
  const dir = resolve(process.argv[2] ?? "");
  const topics = new Map((await q<{ id: string; slug: string }>("SELECT id,slug FROM topics")).map((t) => [t.slug, t.id]));
  if (!topics.size) throw new Error("Rode o seed de temas antes");
  const files = readdirSync(dir).filter((f) => f.endsWith(".txt"));
  let n = 0, linked = 0;
  await tx(async (c) => {
    for (const f of files) {
      const lyrics = readFileSync(join(dir, f), "utf8").replace(/\r\n/g, "\n").trim();
      if (!lyrics) continue;
      const title = f.replace(/\.txt$/, "").normalize("NFC").trim();
      const r = await c.query(`INSERT INTO songs(title,lyrics,source_file) VALUES ($1,$2,$3)
        ON CONFLICT (source_file) DO UPDATE SET title=EXCLUDED.title RETURNING id`, [title, lyrics, f.normalize("NFC")]);
      n++;
      const hay = norm(`${title} ${title} ${lyrics}`) + " ";
      const hits = Object.entries(KEYWORDS).map(([slug, ws]) => [slug, ws.reduce((a, w) => a + hay.split(w).length - 1, 0)] as const)
        .filter(([s, k]) => k >= 2 && topics.has(s)).sort((a, b) => b[1] - a[1]).slice(0, 2);
      for (const [slug] of hits) {
        await c.query("INSERT INTO song_topics(song_id,topic_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [r.rows[0].id, topics.get(slug)]); linked++;
      }
    }
  });
  console.log(`${n} letras importadas como rascunho; ${linked} sugestões de tema.`);
}
main().then(() => pool().end()).catch((e) => { console.error(e); process.exit(1); });
