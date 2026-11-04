import { beforeEach, describe, expect, it } from "vitest";
import { one, q } from "../lib/db";
import { login, changePassword } from "../lib/services/accounts";
import * as users from "../lib/services/appUsers";
import * as an from "../lib/services/analytics";
import * as usage from "../lib/services/usage";
import * as comp from "../lib/services/companion";
import { getPreferences, savePreferences, setCompanion } from "../lib/services/user";
import { userFromToken, createSession } from "../lib/auth";
import { mkUser, publishedJourney, reset } from "./helpers";

beforeEach(reset);

describe("gestão de usuários do app (CMS)", () => {
  it("cria com senha temporária, exige troca, bloqueia, redefine e exclui", async () => {
    const admin = await mkUser("adm@x.org", "admin");
    const { id, temporaryPassword } = await users.createAppUser(admin, { email: "Novo@X.org", displayName: "Novo" });
    expect(temporaryPassword).toHaveLength(12);
    const uid = await login({ email: "novo@x.org", password: temporaryPassword });
    expect(uid).toBe(id);
    const s = await createSession(id);
    expect((await userFromToken(s.token))?.mustChangePassword).toBe(true);
    await changePassword(id, s.token, { currentPassword: temporaryPassword, newPassword: "senha-nova-segura-1" });
    expect((await userFromToken(s.token))?.mustChangePassword).toBe(false);

    const list = await users.listAppUsers(admin, { q: "novo" });
    expect(list.total).toBe(1);
    expect(list.rows[0]).toMatchObject({ email: "novo@x.org", displayName: "Novo" });

    await users.updateAppUser(admin, id, { blocked: true });
    expect(await userFromToken(s.token)).toBeNull(); // sessões derrubadas
    await expect(login({ email: "novo@x.org", password: "senha-nova-segura-1" })).rejects.toMatchObject({ status: 403, code: "account_blocked" });
    await users.updateAppUser(admin, id, { blocked: false, displayName: "Renomeado" });
    expect(await login({ email: "novo@x.org", password: "senha-nova-segura-1" })).toBe(id);

    const { temporaryPassword: t2 } = await users.resetAppUserPassword(admin, id);
    expect(await login({ email: "novo@x.org", password: t2 })).toBe(id);
    const detail: any = await users.getAppUser(admin, id);
    expect(detail).toMatchObject({ displayName: "Renomeado", mustChangePassword: true, notes: 0, bookmarks: 0 });

    await users.deleteAppUser(admin, id);
    expect(await one("SELECT 1 FROM users WHERE id=$1", [id])).toBeNull();
    const acts = (await q("SELECT action FROM audit_logs WHERE actor_id=$1 ORDER BY id", [admin.id])).map((r: any) => r.action);
    expect(acts).toEqual(["app_user.create", "app_user.block", "app_user.unblock", "app_user.password_reset", "app_user.delete"]);
  });
  it("só administradores; não mexe em contas da equipe", async () => {
    const editor = await mkUser("ed@x.org", "editor"), admin = await mkUser("adm@x.org", "admin");
    await expect(users.listAppUsers(editor, {})).rejects.toMatchObject({ status: 403 });
    await expect(users.updateAppUser(admin, editor.id, { blocked: true })).rejects.toMatchObject({ status: 409 });
  });
});

describe("métricas anônimas", () => {
  it("agrega atividade, geografia, conclusão e suprime grupos pequenos", async () => {
    const { id: journeyId } = await publishedJourney();
    const analyst = await mkUser("an@x.org", "analyst");
    const steps = await q<{ id: string }>("SELECT id FROM journey_steps WHERE journey_id=$1 ORDER BY position", [journeyId]);
    for (let i = 0; i < 6; i++) {
      const u = await mkUser(`u${i}@x.org`);
      await usage.trackActivity(u.id, "10.0.0.1");
      for (const s of steps.slice(0, i < 5 ? 3 : 1)) await q("INSERT INTO user_progress(user_id,kind,ref_id,journey_id) VALUES ($1,'step',$2,$3)", [u.id, s.id, journeyId]);
    }
    await usage.trackOpen("journey", journeyId); await usage.trackOpen("journey", journeyId);
    const d: any = await an.dashboard(analyst, 30);
    expect(d.users.registered).toBe(6);
    expect(d.users.activeToday).toBe(6);
    expect(d.geo.countries).toEqual([{ country: "??", userDays: 6 }]);
    expect(d.completion).toMatchObject({ journeysStarted: 6, journeysCompleted: 5, completionRate: 83.3 });
    expect(JSON.stringify(d)).not.toMatch(/@x\.org/);
    const c: any = await an.contentMetrics(analyst, 30);
    expect(c.journeys[0]).toMatchObject({ id: journeyId, opens: 2, starts: 6, completed: 5, inProgress: null });
    const f: any = await an.journeyFunnel(analyst, journeyId, 7);
    expect(f.steps.map((x: any) => x.completed)).toEqual([6, 5, 5]);
    await expect(an.dashboard(await mkUser("e2@x.org", "editor"))).rejects.toMatchObject({ status: 403 });
  });
  it("tempo por área só com consentimento e sem guardar quem enviou", async () => {
    const u = await mkUser("c@x.org");
    expect(await usage.recordAreaTime(u.id, [{ area: "hoje", seconds: 40 }])).toEqual({ recorded: 0 });
    await usage.setAnalyticsConsent(u.id, true);
    await usage.recordAreaTime(u.id, [{ area: "hoje", seconds: 40 }, { area: "hoje", seconds: 20 }, { area: "aprender", seconds: 99999 }]);
    const rows = await q("SELECT area, visits, seconds::int FROM area_time_daily ORDER BY area");
    expect(rows).toEqual([{ area: "aprender", visits: 1, seconds: 3600 }, { area: "hoje", visits: 2, seconds: 60 }]);
    await usage.setAnalyticsConsent(u.id, false);
    expect(await usage.recordAreaTime(u.id, [{ area: "hoje", seconds: 5 }])).toEqual({ recorded: 0 });
  });
});

describe("frases da ovelhinha", () => {
  it("editor cria desligada; publicador habilita; app só vê habilitadas", async () => {
    const editor = await mkUser("ed@x.org", "editor"), pub = await mkUser("pub@x.org", "publisher");
    const r = await comp.createPhrase(editor, { category: "poke", text: "Béé, que bom!" });
    expect((await comp.enabledPhrases()).poke).toEqual([]);
    await expect(comp.createPhrase(editor, { category: "idle", text: "Olá", enabled: true })).rejects.toMatchObject({ status: 403 });
    await expect(comp.updatePhrase(editor, r!.id, { enabled: true })).rejects.toMatchObject({ status: 403 });
    await comp.updatePhrase(editor, r!.id, { text: "Béé, que bom te ver!" });
    await comp.updatePhrase(pub, r!.id, { enabled: true });
    expect((await comp.enabledPhrases()).poke).toEqual(["Béé, que bom te ver!"]);
    await expect(comp.updatePhrase(editor, r!.id, { text: "mudar" })).rejects.toMatchObject({ status: 403 });
    await expect(comp.deletePhrase(editor, r!.id)).rejects.toMatchObject({ status: 403 });
    await comp.deletePhrase(pub, r!.id);
    expect((await comp.listPhrases(pub)).length).toBe(0);
  });
});

describe("personagem (animal bíblico)", () => {
  it("começa sem escolha; a escolha é salva e o onboarding não a apaga", async () => {
    const u = await mkUser("pet@x.org");
    expect(((await getPreferences(u.id)) as any).companion).toBeNull();
    await expect(setCompanion(u.id, { companion: "dragao" })).rejects.toBeTruthy();
    await setCompanion(u.id, { companion: "lion" });
    await savePreferences(u.id, { topicSlugs: [], mode: "read", dailyMinutes: 3 }); // web: sem campo companion
    expect(((await getPreferences(u.id)) as any).companion).toBe("lion");
    await savePreferences(u.id, { topicSlugs: [], mode: "read", dailyMinutes: 3, companion: "dove" });
    expect(((await getPreferences(u.id)) as any)).toMatchObject({ companion: "dove", onboarded: true });
  });
  it("frases: gerais para todos, específicas só para o animal", async () => {
    const pub = await mkUser("pub2@x.org", "publisher");
    await comp.createPhrase(pub, { category: "poke", text: "Você está indo bem.", enabled: true });
    const lion = await comp.createPhrase(pub, { category: "poke", text: "Rrrr! 🦁", enabled: true, animal: "lion" });
    await comp.createPhrase(pub, { category: "poke", text: "Béé! 🐑", enabled: true, animal: "sheep" });
    expect((await comp.enabledPhrases("lion")).poke).toEqual(["Você está indo bem.", "Rrrr! 🦁"]);
    expect((await comp.enabledPhrases("sheep")).poke).toEqual(["Você está indo bem.", "Béé! 🐑"]);
    expect((await comp.enabledPhrases()).poke).toEqual(["Você está indo bem."]);
    expect((await comp.enabledPhrases("unicornio")).poke).toEqual(["Você está indo bem."]);
    await comp.updatePhrase(pub, lion!.id, { animal: null });
    expect((await comp.enabledPhrases("eagle")).poke).toContain("Rrrr! 🦁");
    await comp.updatePhrase(pub, lion!.id, { text: "Rrrr!" }); // sem animal: mantém
    expect((await comp.listPhrases(pub)).find((r: any) => r.id === lion!.id)).toMatchObject({ animal: null, text: "Rrrr!" });
    await expect(comp.createPhrase(pub, { category: "poke", text: "Oi", animal: "gato" as any })).rejects.toBeTruthy();
  });
});
