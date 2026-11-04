import { beforeEach, describe, expect, it, vi } from "vitest";
import { q, one } from "../lib/db";
import { reset, mkUser } from "./helpers";

const h = vi.hoisted(() => ({ configured: true, calls: [] as string[], impl: null as null | ((t: string) => Promise<any>) }));
vi.mock("../lib/push", () => ({
  pushConfigured: () => h.configured,
  sendApns: async (token: string) => { h.calls.push(token); return h.impl ? h.impl(token) : { status: "sent" }; },
}));
import { processOutbox, OUTBOX_MAX_ATTEMPTS } from "../lib/services/notifications";

const tok = (i: number) => i.toString(16).padStart(64, "0");
/** n dispositivos (um usuário cada) com 1 item pendente; sem horário de silêncio e com teto semanal alto. */
async function seed(n: number) {
  const admin = await mkUser("adm@x.org", "admin");
  const nid = (await one<{ id: string }>("INSERT INTO notifications(title,body,status,sent_by,sent_at,created_by) VALUES ('Título','Corpo do aviso','sent',$1,now(),$1) RETURNING id", [admin.id]))!.id;
  for (let i = 0; i < n; i++) {
    const u = await mkUser(`u${i}@x.org`);
    await q("UPDATE notification_preferences SET quiet_start='00:00', quiet_end='00:00', max_per_week=7 WHERE user_id=$1", [u.id]);
    const d = (await one<{ id: string }>("INSERT INTO devices(user_id,platform,token,env) VALUES ($1,'ios',$2,'production') RETURNING id", [u.id, tok(i + 1)]))!.id;
    await q("INSERT INTO push_outbox(notification_id,device_id) VALUES ($1,$2)", [nid, d]);
  }
}
const rows = () => q<any>("SELECT status,attempts,error,locked_until,next_attempt_at > now() AS future FROM push_outbox ORDER BY id");

describe("push_outbox", () => {
  beforeEach(async () => { await reset(); h.configured = true; h.calls = []; h.impl = null; });

  it("sem credenciais APNs não consome nem descarta nada", async () => {
    await seed(3); h.configured = false;
    const r = await processOutbox();
    expect(r).toMatchObject({ pushNotConfigured: true, pushSent: 0, pushSkipped: 0 });
    expect(h.calls).toHaveLength(0);
    expect((await rows()).every((x) => x.status === "pending" && x.attempts === 0 && !x.locked_until)).toBe(true);
  });

  it("executores concorrentes nunca enviam o mesmo item duas vezes", async () => {
    await seed(40);
    h.impl = async () => { await new Promise((r) => setTimeout(r, 5)); return { status: "sent" }; };
    const rs = await Promise.all([processOutbox(), processOutbox(), processOutbox(), processOutbox()]);
    expect(h.calls).toHaveLength(40);
    expect(new Set(h.calls).size).toBe(40);
    expect(rs.reduce((a, r) => a + r.pushSent, 0)).toBe(40);
    expect((await rows()).every((x) => x.status === "sent" && !x.locked_until)).toBe(true);
  });

  it("falha transitória agenda nova tentativa com backoff e mantém pendente", async () => {
    await seed(1); h.impl = async () => ({ status: "failed", error: "timeout", retryable: true });
    expect(await processOutbox()).toMatchObject({ pushRetry: 1, pushFailed: 0 });
    const [x] = await rows();
    expect(x).toMatchObject({ status: "pending", attempts: 1, error: "timeout", future: true }); expect(x.locked_until).toBeNull();
    h.calls = []; expect((await processOutbox()).pushRetry).toBe(0); expect(h.calls).toHaveLength(0); // ainda em backoff
  });

  it("falha definitiva marca failed; transitória esgota as tentativas e vira failed", async () => {
    await seed(1); h.impl = async () => ({ status: "failed", error: "APNs 410 Unregistered" });
    expect(await processOutbox()).toMatchObject({ pushFailed: 1 });
    expect((await rows())[0].status).toBe("failed");
    await reset(); await seed(1); h.impl = async () => ({ status: "failed", error: "timeout", retryable: true });
    await q("UPDATE push_outbox SET attempts=$1", [OUTBOX_MAX_ATTEMPTS - 1]);
    expect(await processOutbox()).toMatchObject({ pushFailed: 1, pushRetry: 0 });
  });

  it("item reservado (lease ativo) é ignorado; lease expirado volta à fila", async () => {
    await seed(2);
    await q("UPDATE push_outbox SET locked_until=now()+interval '5 minutes' WHERE id=(SELECT min(id) FROM push_outbox)");
    expect((await processOutbox()).pushSent).toBe(1);
    await q("UPDATE push_outbox SET locked_until=now()-interval '1 second' WHERE status='pending'");
    expect((await processOutbox()).pushSent).toBe(1);
  });

  it("respeita horário de silêncio (adia) e teto semanal (skipped)", async () => {
    await seed(2);
    await q("UPDATE notification_preferences SET quiet_start='00:00', quiet_end='23:59' WHERE user_id=(SELECT user_id FROM devices ORDER BY id LIMIT 1)");
    await q("UPDATE notification_preferences SET max_per_week=0 WHERE user_id=(SELECT user_id FROM devices ORDER BY id DESC LIMIT 1)");
    const r = await processOutbox();
    expect(r).toMatchObject({ pushDeferred: 1, pushSkipped: 1, pushSent: 0 });
  });
});
