/**
 * Importa uma Bíblia ProPresenter (.rvbible = zip com USX) para bible_passages (1 linha por versículo).
 * Uso: npm run import-bible -w apps/web -- ../../bible/ACF.rvbible
 * Idempotente: reimportar substitui os versículos da tradução.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pool, q, one, tx } from "../lib/db";

process.loadEnvFile?.(".env.local");

const ORDER = "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV".split(" ");
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Informe o caminho do .rvbible");
  const dir = mkdtempSync(join(tmpdir(), "rvbible-"));
  try {
    execFileSync("unzip", ["-oq", resolve(file), "-x", "__MACOSX/*", "-d", dir]);
    const root = join(dir, readdirSync(dir).find((d) => !d.startsWith("."))!);
    const meta = readFileSync(join(root, "metadata.xml"), "utf8");
    const names = new Map<string, string>();
    for (const m of meta.matchAll(/<book code="(\w+)"><long>.*?<\/long><short>(.*?)<\/short>/g)) names.set(m[1], decode(m[2]));
    const code = /<abbreviation>(.*?)<\/abbreviation>/.exec(meta)![1];
    const fullName = decode(/<nameLocal>(.*?)<\/nameLocal>/.exec(meta)![1]);

    const rows: [string, string, number, number, string][] = []; // code, name, chapter, verse, text
    const usxDir = join(root, "USX_1");
    for (const f of readdirSync(usxDir).filter((f) => f.endsWith(".usx"))) {
      const xml = readFileSync(join(usxDir, f), "utf8");
      const bookCode = /<book code="(\w+)"/.exec(xml)![1];
      const name = names.get(bookCode) ?? bookCode;
      let chapter = 0;
      // Tokeniza em marcadores de capítulo/versículo; o texto vem logo após cada marcador de versículo.
      const parts = xml.split(/(<chapter [^>]*\/>|<verse [^>]*\/>)/);
      let verse = 0;
      for (const p of parts) {
        const c = /^<chapter number="(\d+)"/.exec(p);
        const v = /^<verse number="(\d+)"/.exec(p);
        if (c) { chapter = +c[1]; verse = 0; }
        else if (v) verse = +v[1];
        else if (verse && chapter) {
          const text = decode(p.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
          if (text) rows.push([bookCode, name, chapter, verse, text]);
        }
      }
    }
    if (rows.length < 31000) throw new Error(`Importação suspeita: apenas ${rows.length} versículos`);

    await tx(async (c) => {
      const t = (await c.query(
        `INSERT INTO bible_translations(code,name,edition,license,distribution_allowed) VALUES ($1,$2,$3,$4,true)
         ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, edition=EXCLUDED.edition, license=EXCLUDED.license, distribution_allowed=true
         RETURNING id`,
        [code, fullName, "Importada de .rvbible (USX)",
         "Direitos de uso declarados pela instituição em 2026-10-31. Anexar o instrumento de licença ao dossiê do projeto."])).rows[0];
      await c.query("DELETE FROM bible_passages WHERE translation_id=$1 AND verse_start=verse_end AND id NOT IN (SELECT passage_id FROM user_bookmarks)", [t.id]);
      for (let i = 0; i < rows.length; i += 1000) {
        const chunk = rows.slice(i, i + 1000);
        const vals: unknown[] = [];
        const ph = chunk.map((r, k) => {
          vals.push(t.id, r[1], r[0], ORDER.indexOf(r[0]) + 1, r[2], r[3], r[3], r[4]);
          const b = k * 8;
          return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8})`;
        });
        await c.query(`INSERT INTO bible_passages(translation_id,book,book_code,book_order,chapter,verse_start,verse_end,text) VALUES ${ph.join(",")}
          ON CONFLICT (translation_id,book,chapter,verse_start,verse_end) DO UPDATE SET text=EXCLUDED.text, book_code=EXCLUDED.book_code, book_order=EXCLUDED.book_order`, vals);
      }
    });
    console.log(`${code}: ${rows.length} versículos, ${new Set(rows.map((r) => r[0])).size} livros`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
main().then(() => pool().end()).catch((e) => { console.error(e); process.exit(1); });
void q; void one;
