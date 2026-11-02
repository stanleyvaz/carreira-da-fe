/** Seed: apenas os temas iniciais. Bíblia: import-bible. Conteúdo: import-content. */
import { q, pool } from "../lib/db";

process.loadEnvFile?.(".env.local");

const TOPICS = ["Fé", "Oração", "Perdão", "Família", "Casamento", "Relacionamentos", "Trabalho", "Sabedoria", "Domínio próprio",
  "Honestidade", "Generosidade", "Perseverança", "Conhecimento bíblico", "Personagens bíblicos", "Ensinamentos de Jesus"];
const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");

async function main() {
  for (const [i, t] of TOPICS.entries())
    await q("INSERT INTO topics(slug,name,sort_order) VALUES ($1,$2,$3) ON CONFLICT (slug) DO NOTHING", [slug(t), t, i]);
  console.log("Temas criados. Próximos passos: import-bible, import-content, create-admin (veja o README).");
}
main().then(() => pool().end()).catch((e) => { console.error(e); process.exit(1); });
