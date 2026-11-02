import { beforeEach, describe, expect, it } from "vitest";
import { q, one } from "../lib/db";
import { login, deleteAccount, exportData, register } from "../lib/services/accounts";
import * as u from "../lib/services/user";
import { rateLimit } from "../lib/services/ratelimit";
import { userFromToken, createSession, destroySession } from "../lib/auth";
import { mkUser, reset } from "./helpers";

beforeEach(reset);

describe("conta e sessão", () => {
  it("exige aceite dos termos e senha mínima", async () => {
    await expect(register({ email: "a@b.co", password: "curta", acceptTerms: true })).rejects.toThrow();
    await expect(register({ email: "a@b.co", password: "senha-segura-123", acceptTerms: false as any })).rejects.toThrow();
  });
  it("não cadastra e-mail duplicado (case-insensitive) e valida login", async () => {
    const a = await mkUser("Ana@x.org");
    await expect(register({ email: "ana@X.org", password: "senha-segura-123", acceptTerms: true })).rejects.toThrow(/já cadastrado/);
    expect(await login({ email: "ana@x.org", password: "senha-segura-123" })).toBe(a.id);
    await expect(login({ email: "ana@x.org", password: "errada-errada" })).rejects.toThrow(/inválidos/);
    await expect(login({ email: "naoexiste@x.org", password: "senha-segura-123" })).rejects.toThrow(/inválidos/);
  });
  it("senha é armazenada com hash e token de sessão só como hash", async () => {
    const a = await mkUser("h@x.org");
    const { token } = await createSession(a.id);
    expect((await one("SELECT password_hash FROM users WHERE id=$1", [a.id]))!.password_hash).toMatch(/^scrypt\$/);
    expect(await one("SELECT 1 FROM sessions WHERE id_hash=$1", [token])).toBeNull();
    expect((await userFromToken(token))?.id).toBe(a.id);
    await destroySession(token);
    expect(await userFromToken(token)).toBeNull();
  });
  it("sessão expirada é rejeitada", async () => {
    const a = await mkUser("e@x.org");
    const { token } = await createSession(a.id);
    await q("UPDATE sessions SET expires_at = now() - interval '1 second'");
    expect(await userFromToken(token)).toBeNull();
  });
  it("limita tentativas por minuto (429)", async () => {
    for (let i = 0; i < 5; i++) await rateLimit("login:1.1.1.1", 5);
    await expect(rateLimit("login:1.1.1.1", 5)).rejects.toMatchObject({ status: 429 });
  });
});

describe("anotações privadas", () => {
  it("são cifradas em repouso e ilegíveis por outro usuário", async () => {
    const a = await mkUser("a@x.org"), b = await mkUser("b@x.org");
    const n = await u.createNote(a.id, { body: "segredo do coração" });
    const raw = await one("SELECT body_enc FROM private_notes WHERE id=$1", [n!.id]);
    expect(raw!.body_enc).not.toContain("segredo");
    expect((await u.listNotes(a.id))[0].body).toBe("segredo do coração");
    expect(await u.listNotes(b.id)).toHaveLength(0);
    await expect(u.updateNote(b.id, n!.id, "invasão")).rejects.toMatchObject({ status: 404 });
    await expect(u.deleteNote(b.id, n!.id)).rejects.toMatchObject({ status: 404 });
    expect((await u.listNotes(a.id))[0].body).toBe("segredo do coração");
  });
});

describe("LGPD", () => {
  it("exporta dados com notas decifradas e exclui tudo em cascata", async () => {
    const a = await mkUser("lgpd@x.org");
    await u.createNote(a.id, { body: "minha nota" });
    const exp = await exportData(a.id);
    expect(exp.notes[0].body).toBe("minha nota");
    expect((exp.user as any).email).toBe("lgpd@x.org");
    await deleteAccount(a.id);
    for (const t of ["users", "private_notes", "user_preferences", "sessions", "user_consents"])
      expect((await q(`SELECT 1 FROM ${t} WHERE ${t === "users" ? "id" : "user_id"}=$1`, [a.id]))).toHaveLength(0);
    expect(await one("SELECT 1 FROM audit_logs WHERE action='account.delete'")).not.toBeNull();
  });
});
