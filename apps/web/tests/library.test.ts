import { beforeEach, describe, expect, it } from "vitest";
import { one, q } from "../lib/db";
import * as u from "../lib/services/user";
import { mkUser, publishedJourney, reset } from "./helpers";

beforeEach(reset);

async function passage(book = "Salmos", chapter = 23, vs = 1) {
  const t = await one<{ id: string }>("INSERT INTO bible_translations(code,name,edition,license) VALUES ('ACF','ACF','2011','pd') ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name RETURNING id");
  return (await one<{ id: string }>("INSERT INTO bible_passages(translation_id,book,chapter,verse_start,verse_end,text) VALUES ($1,$2,$3,$4,$4,'O Senhor é o meu pastor') RETURNING id", [t!.id, book, chapter, vs]))!.id;
}

describe("anotações com contexto", () => {
  it("traz data, título da etapa, dia, jornada e versículo", async () => {
    const { id: journeyId } = await publishedJourney();
    const user = await mkUser("n@x.org");
    const step = (await one<{ id: string }>("SELECT id FROM journey_steps WHERE journey_id=$1 AND position=2", [journeyId]))!;
    await q("UPDATE journey_steps SET passage_id=$2 WHERE id=$1", [step.id, await passage()]);
    await u.createNote(user.id, { body: "minha nota", refKind: "step", refId: step.id });
    await u.createNote(user.id, { body: "solta" });
    const list: any[] = await u.listNotes(user.id);
    const n = list.find((x) => x.body === "minha nota");
    expect(n).toMatchObject({ refKind: "step", refTitle: "Etapa 2", stepPosition: 2, journeyId, journeyTitle: "Jornada de teste", passageRef: "Salmos 23:1" });
    expect(n.createdAt).toBeTruthy();
    expect(list.find((x) => x.body === "solta")).toMatchObject({ refTitle: null, passageRef: null });
  });
  it("editar atualiza updatedAt e mantém createdAt", async () => {
    const user = await mkUser("e@x.org");
    const { id } = (await u.createNote(user.id, { body: "antes" }))!;
    const before: any = (await u.listNotes(user.id))[0];
    await u.updateNote(user.id, id, "depois");
    const after: any = (await u.listNotes(user.id))[0];
    expect(after.body).toBe("depois");
    expect(new Date(after.createdAt).getTime()).toBe(new Date(before.createdAt).getTime());
  });
});

describe("favoritos", () => {
  it("listam data e origem; remoção é idempotente e isolada por usuário", async () => {
    const { id: journeyId } = await publishedJourney();
    const a = await mkUser("a@x.org"), b = await mkUser("b@x.org");
    const p = await passage();
    const step = (await one<{ id: string }>("SELECT id FROM journey_steps WHERE journey_id=$1 AND position=1", [journeyId]))!;
    await q("UPDATE journey_steps SET passage_id=$2 WHERE id=$1", [step.id, p]);
    await u.toggleBookmark(a.id, p); await u.toggleBookmark(b.id, p);
    const [fav]: any[] = await u.listBookmarks(a.id);
    expect(fav).toMatchObject({ passageId: p, book: "Salmos", reference: "Salmos 23:1" });
    expect(fav.createdAt).toBeTruthy();
    expect(fav.sources[0]).toMatchObject({ kind: "step", id: step.id, journeyId, position: 1 });
    await u.removeBookmark(a.id, p); await u.removeBookmark(a.id, p);
    expect(await u.listBookmarks(a.id)).toHaveLength(0);
    expect(await u.listBookmarks(b.id)).toHaveLength(1);
  });
  it("a etapa informa se o versículo já está favoritado", async () => {
    const { id: journeyId } = await publishedJourney();
    const user = await mkUser("f@x.org");
    const p = await passage();
    const step = (await one<{ id: string }>("SELECT id FROM journey_steps WHERE journey_id=$1 AND position=1", [journeyId]))!;
    await q("UPDATE journey_steps SET passage_id=$2 WHERE id=$1", [step.id, p]);
    expect(((await u.getStep(user.id, step.id)) as any).passage.bookmarked).toBe(false);
    await u.toggleBookmark(user.id, p);
    expect(((await u.getStep(user.id, step.id)) as any).passage.bookmarked).toBe(true);
  });
});

describe("conteúdo de origem de favoritos e anotações", () => {
  it("abre se publicado; arquivado aparece como indisponível com resumo", async () => {
    const { id: journeyId } = await publishedJourney();
    const user = await mkUser("o@x.org");
    const p = await passage();
    const step = (await one<{ id: string }>("SELECT id FROM journey_steps WHERE journey_id=$1 AND position=1", [journeyId]))!;
    await q("UPDATE journey_steps SET passage_id=$2, context='Contexto da etapa' WHERE id=$1", [step.id, p]);
    await q("UPDATE learning_journeys SET summary='Resumo da jornada' WHERE id=$1", [journeyId]);
    await u.toggleBookmark(user.id, p);
    expect((await u.listBookmarks(user.id) as any[])[0].sources[0]).toMatchObject({ id: step.id, available: true });
    expect(await u.contentSource("step", step.id)).toMatchObject({ available: true, title: "Etapa 1", journeyTitle: "Jornada de teste", passageRef: "Salmos 23:1" });
    await q("UPDATE learning_journeys SET status='archived' WHERE id=$1", [journeyId]);
    expect((await u.listBookmarks(user.id) as any[])[0].sources[0]).toMatchObject({ id: step.id, available: false });
    expect(await u.contentSource("step", step.id)).toMatchObject({ available: false, summary: "Resumo da jornada", position: 1 });
    await q("UPDATE learning_journeys SET status='draft' WHERE id=$1", [journeyId]);
    expect((await u.listBookmarks(user.id) as any[])[0].sources).toHaveLength(0);
    await expect(u.contentSource("step", "00000000-0000-0000-0000-000000000000")).rejects.toMatchObject({ status: 404 });
  });
});
