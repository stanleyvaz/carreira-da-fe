import { q, one } from "../lib/db";
import { register } from "../lib/services/accounts";
import * as ed from "../lib/services/editorial";

export async function reset() {
  await q("TRUNCATE users, topics, songs, resources, notifications, media, bible_translations, editorial_reviews, content_versions, audit_logs, rate_limits CASCADE");
}
export async function mkUser(email: string, role = "user") {
  const id = await register({ email, password: "senha-segura-123", acceptTerms: true });
  if (role !== "user") await q("UPDATE users SET role=$2 WHERE id=$1", [id, role]);
  return { id, role: role as any };
}
export async function mkTopic(slug = "fe") {
  return (await one<{ id: string }>("INSERT INTO topics(slug,name) VALUES ($1,$1) RETURNING id", [slug]))!.id;
}
const step = (n: number) => ({ title: `Etapa ${n}`, question: { prompt: "Pergunta?", options: ["a", "b"], correctIndex: 1, explanation: "porque" } });
/** Cria jornada completa de 3 dias e a leva até 'published' pelo fluxo real. */
export async function publishedJourney() {
  const editor = await mkUser("ed@x.org", "editor"), reviewer = await mkUser("rev@x.org", "reviewer"), pub = await mkUser("pub@x.org", "publisher");
  const topicId = await mkTopic();
  const id = await ed.createJourney(editor, { topicId, title: "Jornada de teste", days: 3 });
  await ed.setJourneySteps(editor, id, [step(1), step(2), step(3)]);
  await ed.transition(editor, "journey", id, { to: "in_review" });
  await ed.transition(reviewer, "journey", id, { to: "approved" });
  await ed.transition(pub, "journey", id, { to: "published" });
  return { id, editor, reviewer, pub, topicId };
}
