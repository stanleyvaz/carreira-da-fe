import { connect } from "node:http2";
import { createPrivateKey, sign } from "node:crypto";

/** Envio via APNs (token-based auth). Sem credenciais, nada é enviado e o motivo fica registrado. */
export type PushResult = { status: "sent" | "failed" | "skipped"; error?: string };
let cached: { jwt: string; at: number } | null = null;
function jwt(): string {
  if (cached && Date.now() - cached.at < 40 * 60_000) return cached.jwt;
  const key = createPrivateKey(process.env.APNS_KEY_P8!.replace(/\\n/g, "\n"));
  const b = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = b({ alg: "ES256", kid: process.env.APNS_KEY_ID }), claims = b({ iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) });
  const sig = sign("sha256", Buffer.from(`${head}.${claims}`), { key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  cached = { jwt: `${head}.${claims}.${sig}`, at: Date.now() };
  return cached.jwt;
}
export const pushConfigured = () => !!(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_BUNDLE_ID && process.env.APNS_KEY_P8);

export async function sendApns(token: string, env: "sandbox" | "production", n: { title: string; body: string; data: Record<string, string> }): Promise<PushResult> {
  if (!pushConfigured()) return { status: "skipped", error: "APNs não configurado (defina APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_KEY_P8)" };
  if (!/^[0-9a-f]{64,200}$/i.test(token)) return { status: "failed", error: "token inválido" };
  return new Promise((resolve) => {
    const c = connect(env === "sandbox" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com");
    const done = (r: PushResult) => { try { c.close(); } catch { /* noop */ } resolve(r); };
    c.on("error", (e) => done({ status: "failed", error: e.message }));
    const req = c.request({ ":method": "POST", ":path": `/3/device/${token}`, authorization: `bearer ${jwt()}`, "apns-topic": process.env.APNS_BUNDLE_ID!, "apns-push-type": "alert", "apns-priority": "5" });
    let status = 0, out = "";
    req.on("response", (h) => { status = Number(h[":status"]); });
    req.on("data", (d) => { out += d; });
    req.on("end", () => done(status === 200 ? { status: "sent" } : { status: "failed", error: `APNs ${status} ${out}`.slice(0, 200) }));
    req.on("error", (e) => done({ status: "failed", error: e.message }));
    req.setTimeout(10_000, () => done({ status: "failed", error: "timeout" }));
    req.end(JSON.stringify({ aps: { alert: { title: n.title, body: n.body }, sound: "default" }, ...n.data }));
  });
}
