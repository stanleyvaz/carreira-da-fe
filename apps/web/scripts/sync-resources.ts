/**
 * Traz para o NOSSO banco o conteúdo das indicações (texto, imagem, áudio/vídeo incorporado, autor),
 * com autorização da Universal. Depois disso o item é editável no CMS e não depende mais da fonte
 * (exceto o arquivo de áudio/vídeo, que continua hospedado na origem — veja README).
 * Não sobrescreve itens já editados à mão (synced_at preenchido) a não ser com --force.
 * Uso: npm run sync-resources -w apps/web [-- --force]
 */
import { one, pool, q } from "../lib/db";
import { storeImage } from "../lib/media";
process.loadEnvFile?.(".env.local");
const force = process.argv.includes("--force");
const UA = "Mozilla/5.0 (compatible; JornadaApp-ContentSync; autorizado pela Universal)";
const okHost = (h: string) => /(^|\.)(universal\.org|amazonaws\.com|cloudfront\.net)$/.test(h);

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", laquo: "«", raquo: "»" };
const decode = (s: string) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
  if (e[0] === "#") { const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
  return ENT[e.toLowerCase()] ?? m;
});
/** Recorta o <div> que começa em `start`, contando aninhamento. */
function divBlock(h: string, start: number) {
  const re = /<\/?div\b[^>]*>/gi; re.lastIndex = start; let depth = 0, m: RegExpExecArray | null;
  while ((m = re.exec(h))) { depth += m[0][1] === "/" ? -1 : 1; if (depth === 0) return h.slice(start, m.index + m[0].length); }
  return h.slice(start);
}
function toText(html: string) {
  const t = html.replace(/<(script|style|iframe)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>/gi, "\n")
    .replace(/<blockquote[^>]*>/gi, "\n\n> ").replace(/<\/blockquote>/gi, "\n\n").replace(/<\/(p|h[1-6]|li|div)>/gi, "\n\n").replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "");
  return decode(t).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/>\s*\n+\s*/g, "> ").trim();
}
const meta = (h: string, prop: string) => decode(h.match(new RegExp(`<meta property="${prop}" content="([^"]*)"`, "i"))?.[1] ?? "");

async function fetchBuf(url: string, max = 3 * 1024 * 1024) {
  const u = new URL(url); if (u.protocol !== "https:" || !okHost(u.hostname)) throw new Error(`host não permitido: ${u.hostname}`);
  const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const b = Buffer.from(await r.arrayBuffer()); if (b.length > max && max > 0) throw new Error("arquivo grande demais"); return b;
}

async function main() {
  const rows = await q<{ id: string; url: string; kind: string; title: string; synced_at: Date | null; image_media_id: string | null }>(
    "SELECT id,url,kind,title,synced_at,image_media_id FROM resources WHERE kind IN ('article','podcast_episode') ORDER BY created_at");
  let ok = 0, skipped = 0, failed = 0;
  for (const r of rows) {
    if (r.synced_at && !force) { skipped++; continue; }
    try {
      const html = (await fetchBuf(r.url, 5 * 1024 * 1024)).toString("utf8");
      const i = html.indexOf('class="m-single-content"');
      const block = i >= 0 ? divBlock(html, html.lastIndexOf("<div", i)) : "";
      const video = block.match(/<iframe[^>]+src="(https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\/[\w-]+)/i)?.[1] ?? null;
      const body = block ? toText(block) : "";
      const audio = meta(html, "og:audio") || null;
      const author = decode(html.match(/m-single-author-text[\s\S]*?<p[^>]*>([^<]+)<\/p>/i)?.[1] ?? "").trim() || null;
      let imageId: string | null = r.image_media_id;
      const img = meta(html, "og:image");
      if (img && !imageId) { try { imageId = await storeImage("content", null, await fetchBuf(img)); } catch (e: any) { console.warn(`  imagem ignorada (${e.message})`); } }
      await q(`UPDATE resources SET body=COALESCE(NULLIF($2,''),body), video_url=COALESCE($3,video_url), audio_url=COALESCE($4,audio_url), author_name=COALESCE($5,author_name),
        image_media_id=$6, synced_at=now(), updated_at=now() WHERE id=$1`, [r.id, body, video, audio && audio.startsWith("https://") ? audio : null, author, imageId]);
      console.log(`✓ ${r.title.slice(0, 60)} — ${body.length} caracteres${video ? ", vídeo" : ""}${audio ? ", áudio" : ""}${imageId ? ", imagem" : ""}`);
      ok++;
    } catch (e: any) { console.error(`✗ ${r.title.slice(0, 60)}: ${e.message}`); failed++; }
    await new Promise((s) => setTimeout(s, 1000)); // gentil com a origem
  }
  console.log(`${ok} sincronizados, ${skipped} já sincronizados, ${failed} com erro.`);
  void one;
}
main().then(() => pool().end()).catch((e) => { console.error(e); process.exit(1); });
