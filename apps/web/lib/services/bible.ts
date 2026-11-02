import { one, q } from "../db";
import { HttpError } from "../errors";

/** Retorna (criando se preciso) a passagem do intervalo, com o texto composto dos versículos da tradução. */
export async function resolvePassage(translationCode: string, book: string, chapter: number, v1: number, v2 = v1): Promise<string> {
  const t = await one<{ id: string }>("SELECT id FROM bible_translations WHERE code=$1", [translationCode]);
  if (!t) throw new HttpError(404, `Tradução ${translationCode} não encontrada`);
  const verses = await q<{ book: string; text: string }>(
    `SELECT book,text FROM bible_passages WHERE translation_id=$1 AND (book=$2 OR book_code=$2) AND chapter=$3
       AND verse_start=verse_end AND verse_start BETWEEN $4 AND $5 ORDER BY verse_start`, [t.id, book, chapter, v1, v2]);
  if (verses.length !== v2 - v1 + 1) throw new HttpError(404, `Passagem ${book} ${chapter}:${v1}-${v2} incompleta na tradução ${translationCode}`);
  if (v1 === v2) return (await one<{ id: string }>("SELECT id FROM bible_passages WHERE translation_id=$1 AND book=$2 AND chapter=$3 AND verse_start=$4 AND verse_end=$4", [t.id, verses[0].book, chapter, v1]))!.id;
  const r = await one<{ id: string }>(
    `INSERT INTO bible_passages(translation_id,book,book_code,book_order,chapter,verse_start,verse_end,text)
     SELECT $1,$2,book_code,book_order,$3,$4,$5,$6 FROM bible_passages WHERE translation_id=$1 AND book=$2 AND chapter=$3 AND verse_start=$4 AND verse_end=$4
     ON CONFLICT (translation_id,book,chapter,verse_start,verse_end) DO UPDATE SET text=EXCLUDED.text RETURNING id`,
    [t.id, verses[0].book, chapter, v1, v2, verses.map((v) => v.text).join(" ")]);
  return r!.id;
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "");

/** Interpreta "Colossenses 3:13-14" (ou "1 Coríntios 13:4") e devolve passagem + texto da tradução. */
export async function lookupRef(translationCode: string, ref: string) {
  const m = /^\s*(.+?)\s+(\d+)\s*[:.,]\s*(\d+)(?:\s*[-–]\s*(\d+))?\s*$/.exec(ref);
  if (!m) throw new HttpError(400, `Referência inválida: "${ref}". Use o formato "Livro 3:16" ou "Livro 3:16-18".`);
  const books = await q<{ book: string; book_code: string }>(
    `SELECT DISTINCT bp.book, bp.book_code FROM bible_passages bp JOIN bible_translations t ON t.id=bp.translation_id WHERE t.code=$1`, [translationCode]);
  const want = norm(m[1]);
  const exact = books.find((b) => norm(b.book) === want || b.book_code.toLowerCase() === want);
  const cand = exact ? [exact] : books.filter((b) => norm(b.book).startsWith(want));
  if (cand.length !== 1) throw new HttpError(404, `Livro não reconhecido: "${m[1]}"`);
  const [chapter, v1, v2] = [+m[2], +m[3], m[4] ? +m[4] : +m[3]];
  const id = await resolvePassage(translationCode, cand[0].book, chapter, v1, v2);
  const p = await one<{ id: string; text: string }>("SELECT id,text FROM bible_passages WHERE id=$1", [id]);
  return { passageId: id, reference: `${cand[0].book} ${chapter}:${v1}${v2 > v1 ? "-" + v2 : ""}`, text: p!.text };
}
