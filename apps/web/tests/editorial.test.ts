import { beforeEach, describe, expect, it } from "vitest";
import { q, one } from "../lib/db";
import * as ed from "../lib/services/editorial";
import * as u from "../lib/services/user";
import { mkTopic, mkUser, publishedJourney, reset } from "./helpers";

beforeEach(reset);

describe("fluxo editorial", () => {
  it("usuário comum não cria nem transiciona conteúdo", async () => {
    const user = await mkUser("u@x.org");
    await expect(ed.createJourney(user, { topicId: await mkTopic(), title: "Teste", days: 3 })).rejects.toMatchObject({ status: 403 });
  });
  it("conteúdo em rascunho/revisão/aprovado não aparece para usuários; publicado aparece", async () => {
    const editor = await mkUser("ed@x.org", "editor"), reviewer = await mkUser("rv@x.org", "reviewer"), pub = await mkUser("pb@x.org", "publisher");
    const reader = await mkUser("r@x.org");
    const topicId = await mkTopic();
    const id = await ed.createJourney(editor, { topicId, title: "Jornada X", days: 3 });
    const s = { title: "Etapa", question: { prompt: "Pergunta?", options: ["a", "b"], correctIndex: 0 } };
    await ed.setJourneySteps(editor, id, [s, s, s]);
    expect(await u.listJourneys(reader.id)).toHaveLength(0);
    await ed.transition(editor, "journey", id, { to: "in_review" });
    expect(await u.listJourneys(reader.id)).toHaveLength(0);
    await ed.transition(reviewer, "journey", id, { to: "approved" });
    expect(await u.listJourneys(reader.id)).toHaveLength(0);
    await ed.transition(pub, "journey", id, { to: "published" });
    expect(await u.listJourneys(reader.id)).toHaveLength(1);
  });
  it("não publica sem aprovação nem pula etapas", async () => {
    const editor = await mkUser("ed@x.org", "editor"), pub = await mkUser("pb@x.org", "publisher");
    const id = await ed.createJourney(editor, { topicId: await mkTopic(), title: "Jornada X", days: 3 });
    await expect(ed.transition(pub, "journey", id, { to: "published" })).rejects.toMatchObject({ status: 403 });
    await expect(ed.transition({ ...editor, role: "admin" }, "journey", id, { to: "published" })).rejects.toThrow();
    // Constraint do banco também impede publicação sem aprovador
    await expect(q("UPDATE learning_journeys SET status='published' WHERE id=$1", [id])).rejects.toThrow(/check/i);
  });
  it("editor não aprova; admin pode aprovar o próprio conteúdo (marcado na auditoria); autor não-admin não", async () => {
    const admin = await mkUser("ad@x.org", "admin"), editor = await mkUser("ed@x.org", "editor");
    const id = await ed.createReflection(admin, { title: "Reflexão", body: "Texto de reflexão longo" });
    await ed.transition(admin, "reflection", id, { to: "in_review" });
    await expect(ed.transition(editor, "reflection", id, { to: "approved" })).rejects.toMatchObject({ status: 403 });
    await ed.transition(admin, "reflection", id, { to: "approved" });
    const log = await one<{ detail: any }>("SELECT detail FROM audit_logs WHERE entity_id=$1 AND action='reflection.approved'", [id]);
    expect(JSON.stringify(log)).toContain("selfApproved");
    // autor não-admin (perfil que pode aprovar mas não é admin) continua barrado
    const rev = await mkUser("rv2@x.org", "reviewer");
    const id2 = await ed.createReflection(admin, { title: "Outra", body: "Texto de reflexão longo" });
    await q("UPDATE reflections SET author_id=$2 WHERE id=$1", [id2, rev.id]);
    await ed.transition(admin, "reflection", id2, { to: "in_review" });
    await expect(ed.transition(rev, "reflection", id2, { to: "approved" })).rejects.toThrow(/próprio/);
  });
  it("exige etapas completas com pergunta antes da revisão", async () => {
    const editor = await mkUser("ed@x.org", "editor");
    const id = await ed.createJourney(editor, { topicId: await mkTopic(), title: "Jornada X", days: 3 });
    await expect(ed.transition(editor, "journey", id, { to: "in_review" })).rejects.toMatchObject({ status: 422 });
  });
  it("registra revisão, versão e auditoria; rascunho de volta invalida aprovação", async () => {
    const { id, reviewer, editor } = await publishedJourney();
    expect((await q("SELECT 1 FROM editorial_reviews WHERE content_id=$1 AND decision='approved'", [id]))).toHaveLength(1);
    expect((await q("SELECT 1 FROM content_versions WHERE content_id=$1", [id])).length).toBeGreaterThanOrEqual(1);
    expect((await q("SELECT 1 FROM audit_logs WHERE entity_id=$1 AND action='journey.published'", [id]))).toHaveLength(1);
    await expect(ed.setJourneySteps(editor, id, [])).rejects.toMatchObject({ status: 409 });
    void reviewer;
  });
  it("gabarito nunca é enviado ao cliente", async () => {
    const { id } = await publishedJourney();
    const reader = await mkUser("r@x.org");
    const j: any = await u.getJourney(reader.id, id);
    const step: any = await u.getStep(reader.id, j.steps[0].id);
    expect(JSON.stringify(step)).not.toContain("correct");
    expect(await u.completeStep(reader.id, step.id, { answerIndex: 1 })).toMatchObject({ correct: true });
  });
  it("resposta errada não avança nem registra progresso nem revela a certa; correta avança", async () => {
    const { id } = await publishedJourney();
    const reader = await mkUser("r2@x.org");
    const j: any = await u.getJourney(reader.id, id);
    const wrong = await u.completeStep(reader.id, j.steps[0].id, { answerIndex: 0 });
    expect(wrong).toMatchObject({ correct: false });
    expect(JSON.stringify(wrong)).not.toContain("correctIndex");
    expect((await q("SELECT 1 FROM user_progress WHERE user_id=$1 AND kind='step'", [reader.id])).length).toBe(0);
    await expect(u.completeStep(reader.id, j.steps[0].id, {})).rejects.toMatchObject({ status: 422 });
    expect(await u.completeStep(reader.id, j.steps[0].id, { answerIndex: 1 })).toMatchObject({ correct: true, correctIndex: 1 });
    expect((await q("SELECT 1 FROM user_progress WHERE user_id=$1 AND kind='step'", [reader.id])).length).toBe(1);
  });
});

describe("progresso, marcos e métricas", () => {
  it("progresso é individual e gera marcos sem classificação de fé", async () => {
    const { id } = await publishedJourney();
    const a = await mkUser("a@x.org"), b = await mkUser("b@x.org");
    const j: any = await u.getJourney(a.id, id);
    for (const s of j.steps) { await u.completeStep(a.id, s.id, { answerIndex: 1 }); await q("UPDATE user_progress SET completed_at = completed_at - interval '1 day' WHERE user_id=$1", [a.id]); } // uma etapa por dia
    const mine: any = await u.myJourney(a.id);
    expect(mine.milestones).toContain("Primeira jornada concluída");
    expect((await u.myJourney(b.id) as any).counts.steps).toBe(0);
    expect(Object.keys(mine).join()).not.toMatch(/score|rank|level|fé/i);
  });
  it("não exibe usuário ausente por muito tempo como penalidade e ordena por preferências", async () => {
    const { id, topicId } = await publishedJourney();
    const reader = await mkUser("r@x.org");
    const other = await mkTopic("oracao");
    const ed = await mkUser("e2@x.org", "editor");
    await ed.id;
    const j2 = await q("INSERT INTO learning_journeys(topic_id,title,days,status,approved_by) VALUES ($1,'Oração','3','published',$2) RETURNING id", [other, ed.id]);
    await u.savePreferences(reader.id, { topicSlugs: ["oracao"], mode: "read", dailyMinutes: 3 });
    const list: any[] = await u.listJourneys(reader.id);
    expect(list[0].id).toBe(j2[0].id);
    void id; void topicId;
  });
  it("métricas agregadas suprimem grupos pequenos e exigem perfil", async () => {
    const analyst = await mkUser("an@x.org", "analyst"), user = await mkUser("u@x.org");
    await expect(ed.aggregateMetrics(user)).rejects.toMatchObject({ status: 403 });
    const m = await ed.aggregateMetrics(analyst);
    expect(m.activeUsers30d).toBeNull();
    await expect(ed.auditLog(analyst)).rejects.toMatchObject({ status: 403 });
  });
});

describe("músicas", () => {
  it("exigem tema confirmado e créditos; só aparecem publicadas e confirmadas", async () => {
    const { id: jid, editor, reviewer, pub, topicId } = await publishedJourney();
    const reader = await mkUser("rd@x.org");
    const s = await one<{ id: string }>("INSERT INTO songs(title,lyrics) VALUES ('Louvor','letra') RETURNING id");
    await q("INSERT INTO song_topics(song_id,topic_id) VALUES ($1,$2)", [s!.id, topicId]); // sugerido, não confirmado
    await expect(ed.transition(editor, "song", s!.id, { to: "in_review" })).rejects.toMatchObject({ status: 422 });
    await ed.setSongTopics(editor, s!.id, [topicId]);
    await expect(ed.transition(editor, "song", s!.id, { to: "in_review" })).rejects.toMatchObject({ status: 422 }); // sem créditos
    await ed.setSongCredits(editor, s!.id, "Autor X / Editora Y");
    await ed.transition(editor, "song", s!.id, { to: "in_review" });
    const stepId = (await q("SELECT id FROM journey_steps WHERE journey_id=$1 LIMIT 1", [jid]))[0].id;
    expect((await u.getStep(reader.id, stepId) as any).songs).toHaveLength(0);
    await ed.transition(reviewer, "song", s!.id, { to: "approved" });
    await ed.transition(pub, "song", s!.id, { to: "published" });
    expect((await u.getStep(reader.id, stepId) as any).songs).toHaveLength(1);
  });
});
