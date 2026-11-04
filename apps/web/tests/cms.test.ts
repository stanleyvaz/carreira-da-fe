import { beforeEach, describe, expect, it } from "vitest";
import { q, one } from "../lib/db";
import * as ed from "../lib/services/editorial";
import * as u from "../lib/services/user";
import { lookupRef, resolvePassage } from "../lib/services/bible";
import { mkTopic, mkUser, publishedJourney, reset } from "./helpers";

async function seedBible() {
  const t = await one<{ id: string }>("INSERT INTO bible_translations(code,name,edition,license,distribution_allowed) VALUES ('ACF','ACF','x','teste',true) RETURNING id");
  for (const [v, txt] of [[13, "Suportando-vos uns aos outros"], [14, "E sobre tudo isto revesti-vos de amor"]])
    await q("INSERT INTO bible_passages(translation_id,book,book_code,book_order,chapter,verse_start,verse_end,text) VALUES ($1,'Colossenses','COL',51,3,$2,$2,$3)", [t!.id, v, txt]);
}
beforeEach(async () => { await reset(); await q("TRUNCATE bible_passages, bible_translations CASCADE"); });

describe("referências bíblicas", () => {
  it("interpreta referências com acento, caixa e intervalo", async () => {
    await seedBible();
    const r = await lookupRef("ACF", "colossenses 3:13-14");
    expect(r.reference).toBe("Colossenses 3:13-14"); expect(r.text).toContain("Suportando"); expect(r.text).toContain("revesti-vos");
    expect((await lookupRef("ACF", "Col 3:13")).reference).toBe("Colossenses 3:13");
    await expect(lookupRef("ACF", "Colossenses 3:99")).rejects.toMatchObject({ status: 404 });
    await expect(lookupRef("ACF", "isso não é referência")).rejects.toMatchObject({ status: 400 });
    expect(await resolvePassage("ACF", "Colossenses", 3, 13, 14)).toBe(r.passageId);
  });
});

describe("gestão de conteúdo", () => {
  it("só edita rascunhos; edição de jornada resolve passagem pela referência", async () => {
    await seedBible();
    const editor = await mkUser("ed@x.org", "editor"); const topicId = await mkTopic();
    const id = await ed.createJourney(editor, { topicId, title: "Jornada A", days: 3, kind: "challenge" });
    await ed.setJourneySteps(editor, id, [{ title: "Etapa 1", passage: "Colossenses 3:13-14", question: { prompt: "Pergunta?", options: ["a", "b"], correctIndex: 0 } }]);
    const full: any = await ed.getContent(editor, "journey", id);
    expect(full.kind).toBe("challenge"); expect(full.steps[0].passage).toBe("Colossenses 3:13-14"); expect(full.steps[0].passageText).toContain("Suportando");
    await ed.updateContent(editor, "journey", id, { topicId, title: "Jornada B", days: 3, kind: "journey" });
    expect((await ed.getContent(editor, "journey", id) as any).title).toBe("Jornada B");
    await q("UPDATE learning_journeys SET status='in_review' WHERE id=$1", [id]);
    await expect(ed.updateContent(editor, "journey", id, { topicId, title: "X", days: 3 })).rejects.toMatchObject({ status: 409 });
    await expect(ed.deleteDraft(editor, "journey", id)).rejects.toMatchObject({ status: 409 });
  });
  it("duplica e exclui rascunho; usuário comum não pode", async () => {
    const editor = await mkUser("ed@x.org", "editor"); const reader = await mkUser("r@x.org");
    const id = await ed.createActivity(editor, { title: "Gratidão", invitation: "Que tal agradecer?" });
    const copy = await ed.duplicate(editor, "activity", id);
    expect((await ed.getContent(editor, "activity", copy) as any).title).toBe("Gratidão (cópia)");
    await ed.deleteDraft(editor, "activity", copy);
    await expect(ed.duplicate(reader, "activity", id)).rejects.toMatchObject({ status: 403 });
  });
  it("lote valida item a item e respeita papéis", async () => {
    const editor = await mkUser("ed@x.org", "editor"); const reviewer = await mkUser("rv@x.org", "reviewer");
    const a = await ed.createActivity(editor, { title: "Convite A", invitation: "Que tal ouvir?" }); const b = await ed.createActivity(editor, { title: "Convite B", invitation: "Que tal ouvir?" });
    await ed.bulkTransition(editor, "activity", [a, b], "in_review");
    const r = await ed.bulkTransition(reviewer, "activity", [a, b], "approved");
    expect(r.every((x) => x.ok)).toBe(true);
    const bad = await ed.bulkTransition(editor, "activity", [a], "published");
    expect(bad[0].ok).toBe(false);
  });
  it("itens importados (sem autor) podem ser aprovados por revisor, mas não publicados sem aprovação", async () => {
    const reviewer = await mkUser("rv@x.org", "reviewer"); const pub = await mkUser("pb@x.org", "publisher");
    const row = await one<{ id: string }>("INSERT INTO practical_activities(title,invitation,status) VALUES ('Importado','Que tal respirar?','in_review') RETURNING id");
    await expect(ed.transition(pub, "activity", row!.id, { to: "published" })).rejects.toMatchObject({ status: 403 });
    await ed.transition(reviewer, "activity", row!.id, { to: "approved" });
    await ed.transition(pub, "activity", row!.id, { to: "published" });
    expect((await u.listActivities((await mkUser("l@x.org")).id) as any[]).length).toBe(1);
  });
});

describe("destaque (promoção)", () => {
  it("um único destaque, só publicado, aparece para usuários e some ao arquivar", async () => {
    const { id, pub } = await publishedJourney(); const admin = await mkUser("ad@x.org", "admin"); const reader = await mkUser("r@x.org");
    await expect(ed.promote(reader, id, { headline: "Olá mundo" })).rejects.toMatchObject({ status: 403 });
    await ed.promote(pub, id, { headline: "Uma semana para agradecer" });
    expect((await u.getFeatured(reader.id) as any).headline).toBe("Uma semana para agradecer");
    const j2 = await one<{ id: string }>("INSERT INTO learning_journeys(topic_id,title,days,status,approved_by) VALUES ((SELECT topic_id FROM learning_journeys LIMIT 1),'Outra',3,'published',$1) RETURNING id", [admin.id]);
    await ed.promote(admin, j2!.id, { headline: "Novo destaque" });
    expect((await u.getFeatured(reader.id) as any).title).toBe("Outra");
    expect((await q("SELECT 1 FROM learning_journeys WHERE featured")).length).toBe(1);
    await ed.transition(admin, "journey", j2!.id, { to: "archived" });
    expect(await u.getFeatured(reader.id)).toBeNull();
    const draft = await one<{ id: string }>("INSERT INTO learning_journeys(topic_id,title,days) VALUES ((SELECT topic_id FROM learning_journeys LIMIT 1),'Rascunho',3) RETURNING id");
    await expect(ed.promote(admin, draft!.id, { headline: "Não deveria" })).rejects.toMatchObject({ status: 409 });
  });
  it("desafio fora da janela de datas não aparece na biblioteca", async () => {
    const { id } = await publishedJourney(); const reader = await mkUser("r@x.org");
    await q("UPDATE learning_journeys SET kind='challenge', ends_at=current_date-1 WHERE id=$1", [id]);
    expect(await u.listJourneys(reader.id)).toHaveLength(0);
    await q("UPDATE learning_journeys SET ends_at=current_date+1, starts_at=current_date WHERE id=$1", [id]);
    expect(await u.listJourneys(reader.id)).toHaveLength(1);
  });
});

describe("equipe e temas", () => {
  it("só admin gerencia perfis; protege o último admin e o próprio acesso", async () => {
    const admin = await mkUser("ad@x.org", "admin"); const ed1 = await mkUser("e@x.org", "editor"); await mkUser("n@x.org");
    await expect(ed.setRoleByEmail(ed1, "n@x.org", "editor")).rejects.toMatchObject({ status: 403 });
    await ed.setRoleByEmail(admin, "n@x.org", "reviewer");
    expect((await ed.listStaff(admin)).length).toBe(3);
    await expect(ed.setRoleByEmail(admin, "ad@x.org", "editor")).rejects.toMatchObject({ status: 409 });
    await expect(ed.setRoleByEmail(admin, "naoexiste@x.org", "editor")).rejects.toMatchObject({ status: 404 });
  });
  it("editor cria e renomeia temas", async () => {
    const editor = await mkUser("e@x.org", "editor");
    const id = await ed.saveTopic(editor, { name: "Gratidão" });
    expect((await one("SELECT slug FROM topics WHERE id=$1", [id]))!.slug).toBe("gratidao");
    await ed.saveTopic(editor, { id, name: "Gratidão e alegria" });
    await expect(ed.saveTopic(await mkUser("u@x.org"), { name: "X1" })).rejects.toMatchObject({ status: 403 });
  });
});

describe("indicações externas (Saiba mais)", () => {
  it("só aceita links universal.org/https, segue o fluxo editorial e filtra por tema/público", async () => {
    const us = u;
    const editor = await mkUser("re@x.org", "editor"), reviewer = await mkUser("rr@x.org", "reviewer"), pub = await mkUser("rp@x.org", "publisher"), reader = await mkUser("rd2@x.org");
    const topicId = await mkTopic("gratidao");
    const base = { kind: "article" as const, source: "Blog", title: "Gratidão no dia a dia", blurb: "Leitura curta.", audiences: ["homens" as const], topicIds: [topicId] };
    await expect(ed.createResource(editor, { ...base, url: "https://evil.example/universal.org/" })).rejects.toThrow();
    await expect(ed.createResource(editor, { ...base, url: "http://www.universal.org/x" })).rejects.toThrow();
    const id = await ed.createResource(editor, { ...base, url: "https://www.universal.org/x/post/a/" });
    expect(await us.listResources({ topic: "gratidao" })).toHaveLength(0);
    await ed.transition(editor, "resource", id, { to: "in_review" });
    await ed.transition(reviewer, "resource", id, { to: "approved" });
    await ed.transition(pub, "resource", id, { to: "published" });
    expect(await us.listResources({ topic: "gratidao", audience: "homens" })).toHaveLength(1);
    expect(await us.listResources({ topic: "gratidao", audience: "mulheres" })).toHaveLength(0);
  });
});

describe("perfil, mídia e notificações", () => {
  it("troca de senha exige a atual, encerra outras sessões e mantém a atual", async () => {
    const { changePassword, login } = await import("../lib/services/accounts");
    const { createSession } = await import("../lib/auth");
    const { hashPassword } = await import("../lib/crypto");
    const usr = await mkUser("pw@x.org");
    await q("UPDATE users SET password_hash=$2 WHERE id=$1", [usr.id, await hashPassword("senha-antiga-123")]);
    const keep = await createSession(usr.id), other = await createSession(usr.id);
    await expect(changePassword(usr.id, keep.token, { currentPassword: "errada-errada", newPassword: "nova-senha-456" })).rejects.toMatchObject({ status: 403 });
    await expect(changePassword(usr.id, keep.token, { currentPassword: "senha-antiga-123", newPassword: "curta" })).rejects.toThrow();
    await changePassword(usr.id, keep.token, { currentPassword: "senha-antiga-123", newPassword: "nova-senha-456" });
    const left = (await q<{ n: number }>("SELECT count(*)::int AS n FROM sessions WHERE user_id=$1", [usr.id]))[0].n;
    expect(left).toBe(1);
    expect(await login({ email: "pw@x.org", password: "nova-senha-456" })).toBe(usr.id);
    void other;
  });
  it("avatar valida o conteúdo real do arquivo e substitui o anterior", async () => {
    const { setAvatar } = await import("../lib/services/accounts");
    const usr = await mkUser("av@x.org");
    await expect(setAvatar(usr.id, Buffer.from("<svg onload=alert(1)>".padEnd(40, " ")))).rejects.toMatchObject({ status: 415 });
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
    await setAvatar(usr.id, png); await setAvatar(usr.id, png);
    expect((await q("SELECT 1 FROM media WHERE owner_user_id=$1", [usr.id])).length).toBe(1);
  });
  it("notificação: só publicado, respeita preferências do usuário, publisher envia, não reenvia", async () => {
    const n = await import("../lib/services/notifications");
    const editor = await mkUser("ne@x.org", "editor"), pub = await mkUser("np@x.org", "publisher");
    const on = await mkUser("on@x.org"), off = await mkUser("off@x.org");
    await q("UPDATE notification_preferences SET new_content=false WHERE user_id=$1", [off.id]);
    await expect(n.createNotification(editor, { title: "Novo", body: "Tem conteúdo novo", linkKind: "resource", linkId: "00000000-0000-0000-0000-000000000000" })).rejects.toMatchObject({ status: 422 });
    const id = await n.createNotification(editor, { title: "Novo", body: "Tem conteúdo novo", linkKind: "today" });
    await expect(n.sendNotification(editor, id)).rejects.toMatchObject({ status: 403 });
    expect((await n.sendNotification(pub, id)).recipients).toBeGreaterThanOrEqual(1);
    expect((await n.inbox(on.id)).length).toBe(1);
    expect((await n.inbox(off.id)).length).toBe(0);
    await expect(n.sendNotification(pub, id)).rejects.toMatchObject({ status: 409 });
    await expect(n.registerDevice(on.id, { platform: "ios", token: "curto" })).rejects.toThrow();
  });
});

describe("hábito: primeiros 7 dias, recomeço sem culpa e âncora", () => {
  it("jornada de entrada: só publicada, única, e acompanha o progresso individual", async () => {
    const { id, editor, reviewer, pub } = await publishedJourney();
    const reader = await mkUser("st@x.org"), admin = await mkUser("sa@x.org", "admin");
    expect(await u.getStarter(reader.id)).toBeNull();
    await expect(ed.setStarter(editor, id, true)).rejects.toMatchObject({ status: 403 });
    await ed.setStarter(pub, id, true);
    const s0: any = await u.getStarter(reader.id);
    expect(s0).toMatchObject({ id, doneSteps: 0, complete: false, day: 1 });
    const j: any = await u.getJourney(reader.id, id);
    await u.completeStep(reader.id, j.steps[0].id, { answerIndex: 1 });
    expect(((await u.getStarter(reader.id)) as any).doneSteps).toBe(1);
    // despublicar remove a marca de entrada
    await ed.transition(admin, "journey", id, { to: "archived" });
    expect(await u.getStarter(reader.id)).toBeNull();
    void reviewer;
  });
  it("recomeço sem culpa: acolhe após 3+ dias parado; metas leves na primeira semana; âncora liga o lembrete", async () => {
    const usr = await mkUser("wb@x.org");
    expect(((await u.weekOverview(usr.id)) as any).welcomeBack).toBeNull();
    const { id } = await publishedJourney();
    const j: any = await u.getJourney(usr.id, id);
    await u.completeStep(usr.id, j.steps[0].id, { answerIndex: 1 });
    await q("UPDATE user_progress SET completed_at = now() - interval '5 days' WHERE user_id=$1", [usr.id]);
    const w: any = await u.weekOverview(usr.id);
    expect(w.welcomeBack).toMatchObject({ daysAway: 5 });
    expect(w.newcomer).toBe(true);
    expect(w.goals.reflections).toBe(3); // meta mínima na primeira semana
    await u.savePreferences(usr.id, { topicSlugs: [], mode: "read", dailyMinutes: 3, reminderTime: "08:00", anchor: "depois do café" });
    expect(((await u.getPreferences(usr.id)) as any).anchor).toBe("depois do café");
    expect(((await q("SELECT enabled,reading_reminder FROM notification_preferences WHERE user_id=$1", [usr.id]))[0])).toMatchObject({ enabled: true, reading_reminder: true });
  });
});

describe("ritmo: valorizar cada etapa e cada desafio", () => {
  it("1 etapa por dia por jornada; revisitar etapa feita é livre; no dia seguinte libera", async () => {
    const { id } = await publishedJourney();
    const r = await mkUser("pace@x.org");
    const j: any = await u.getJourney(r.id, id);
    await u.completeStep(r.id, j.steps[0].id, { answerIndex: 1 });
    await expect(u.completeStep(r.id, j.steps[1].id, { answerIndex: 1 })).rejects.toMatchObject({ status: 409 });
    expect(((await u.getStep(r.id, j.steps[1].id)) as any).pacing.locked).toBe(true);
    expect(((await u.getJourney(r.id, id)) as any).pacing.locked).toBe(true);
    expect(await u.completeStep(r.id, j.steps[0].id, { answerIndex: 1 })).toMatchObject({ correct: true }); // já feita: livre
    await q("UPDATE user_progress SET completed_at = completed_at - interval '1 day' WHERE user_id=$1", [r.id]);
    expect(await u.completeStep(r.id, j.steps[1].id, { answerIndex: 1 })).toMatchObject({ correct: true });
  });
  it("um desafio em andamento por vez", async () => {
    const { id: a, editor, reviewer, pub, topicId } = await publishedJourney();
    await q("UPDATE learning_journeys SET kind='challenge' WHERE id=$1", [a]);
    const b = await ed.createJourney(editor, { topicId, title: "Outro desafio", days: 3, kind: "challenge" });
    const st = { title: "Etapa", question: { prompt: "Pergunta?", options: ["x", "y"], correctIndex: 0 } };
    await ed.setJourneySteps(editor, b, [st, st, st]);
    await ed.transition(editor, "journey", b, { to: "in_review" });
    await ed.transition(reviewer, "journey", b, { to: "approved" });
    await ed.transition(pub, "journey", b, { to: "published" });
    const r = await mkUser("two@x.org");
    const ja: any = await u.getJourney(r.id, a);
    const stepB = (await q("SELECT id FROM journey_steps WHERE journey_id=$1 ORDER BY position LIMIT 1", [b]))[0].id;
    await u.completeStep(r.id, ja.steps[0].id, { answerIndex: 1 });
    await q("UPDATE user_progress SET completed_at = completed_at - interval '1 day' WHERE user_id=$1", [r.id]);
    // o outro desafio fica visível na lista, porém trancado, com previsão (2 etapas restantes, hoje ainda não feito)
    const list: any[] = await u.listJourneys(r.id);
    const lb = list.find((x) => x.id === b);
    expect(lb.lock).toMatchObject({ locked: true, days: 1 });
    expect(lb.lock.reason).toMatch(/Libera ao concluir/);
    expect(list.find((x) => x.id === a).lock.locked).toBe(false);
    await expect(u.getJourney(r.id, b)).rejects.toMatchObject({ status: 423 });
    await expect(u.getStep(r.id, stepB)).rejects.toMatchObject({ status: 423 });
    await expect(u.completeStep(r.id, stepB, { answerIndex: 0 })).rejects.toThrow(/Libera ao concluir/);
  });
  it("limite diário geral de etapas", async () => {
    const { id: a, editor, reviewer, pub, topicId } = await publishedJourney();
    const r = await mkUser("cap@x.org");
    const mk = async (title: string) => {
      const j = await ed.createJourney(editor, { topicId, title, days: 3 });
      const st = { title: "Etapa", question: { prompt: "Pergunta?", options: ["x", "y"], correctIndex: 0 } };
      await ed.setJourneySteps(editor, j, [st, st, st]);
      await ed.transition(editor, "journey", j, { to: "in_review" }); await ed.transition(reviewer, "journey", j, { to: "approved" }); await ed.transition(pub, "journey", j, { to: "published" });
      return j;
    };
    const b = await mk("Jornada B"), c = await mk("Jornada C");
    for (const jid of [a, b]) { const jj: any = await u.getJourney(r.id, jid); await u.completeStep(r.id, jj.steps[0].id, { answerIndex: jid === a ? 1 : 0 }); }
    const jc: any = await u.getJourney(r.id, c);
    await expect(u.completeStep(r.id, jc.steps[0].id, { answerIndex: 0 })).rejects.toThrow(/Hoje você já concluiu/);
  });
});

describe("praticar: um convite por dia", () => {
  it("depois do convite do dia os demais ficam visíveis só com o título, trancados, e libera no dia seguinte", async () => {
    const editor = await mkUser("pe@x.org", "editor"), reviewer = await mkUser("pr@x.org", "reviewer"), pub = await mkUser("pp@x.org", "publisher");
    const ids: string[] = [];
    for (const t of ["Convite A", "Convite B"]) {
      const id = await ed.createActivity(editor, { title: t, invitation: "Faça algo bom hoje" });
      await ed.transition(editor, "activity", id, { to: "in_review" }); await ed.transition(reviewer, "activity", id, { to: "approved" }); await ed.transition(pub, "activity", id, { to: "published" });
      ids.push(id);
    }
    const r = await mkUser("prat@x.org");
    let list: any[] = await u.listActivities(r.id);
    expect(list.every((x) => !x.lock.locked)).toBe(true);
    await u.completeActivity(r.id, ids[0]);
    list = await u.listActivities(r.id);
    const locked = list.find((x) => x.id === ids[1]);
    expect(locked.lock).toMatchObject({ locked: true });
    expect(locked.lock.reason).toMatch(/Libera em cerca de \d+h/);
    expect(locked.invitation).toBeNull(); // só o título
    expect(list.find((x) => x.id === ids[0]).done).toBe(true);
    await expect(u.completeActivity(r.id, ids[1])).rejects.toMatchObject({ status: 409 });
    await q("UPDATE user_progress SET completed_at = completed_at - interval '1 day' WHERE user_id=$1", [r.id]);
    await u.completeActivity(r.id, ids[1]);
  });
});

describe("salvamento atômico de jornada", () => {
  it("grava metadados e etapas juntos; falha de validação não altera nada", async () => {
    await seedBible();
    const editor = await mkUser("atomico@x.org", "editor"); const topicId = await mkTopic();
    const id = await ed.createJourney(editor, { topicId, title: "Antes", days: 3, kind: "journey" });
    await ed.updateContent(editor, "journey", id, { topicId, title: "Depois", days: 3, kind: "journey", steps: [{ title: "Etapa 1", passage: "Colossenses 3:13" }] });
    const ok: any = await ed.getContent(editor, "journey", id);
    expect(ok.title).toBe("Depois"); expect(ok.steps).toHaveLength(1); expect(ok.steps[0].passage).toBe("Colossenses 3:13");
    await expect(ed.updateContent(editor, "journey", id, { topicId, title: "Nunca", days: 3, kind: "journey", steps: [{ title: "Etapa X", passage: "Colossenses 3:99" }] })).rejects.toMatchObject({ status: 404 });
    const after: any = await ed.getContent(editor, "journey", id);
    expect(after.title).toBe("Depois"); expect(after.steps).toHaveLength(1);
  });
});
