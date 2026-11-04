import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./errors";
import { requireStaff, requireUser, type SessionUser } from "./auth";
import { rateLimit } from "./services/ratelimit";

type Ctx<P> = { params: Promise<P> };
export type Handler<P> = (req: NextRequest, ctx: { params: P; user: SessionUser }) => Promise<unknown>;

function ip(req: NextRequest) { return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local"; }

/** Defesa CSRF para cookies de sessão: mutações exigem mesma origem (Origin ausente = cliente não-navegador). */
function sameOrigin(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
  const o = req.headers.get("origin");
  // Atrás de proxy (Tailscale Funnel) o Next standalone vê origin=http://HOSTNAME:PORT; a origem pública vem de APP_PUBLIC_ORIGINS (lista separada por vírgulas).
  const extra = (process.env.APP_PUBLIC_ORIGINS ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  return !o || o === req.nextUrl.origin || extra.includes(o);
}

export function api<P = Record<string, string>>(h: Handler<P>, opts: { auth?: "user" | "staff" | "none"; limit?: { key: string; max: number } } = {}) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      if (!sameOrigin(req)) throw new HttpError(403, "Origem inválida");
      if (opts.limit) await rateLimit(`${opts.limit.key}:${ip(req)}`, opts.limit.max);
      const auth = opts.auth ?? "user";
      const user = auth === "none" ? (null as unknown as SessionUser) : auth === "staff" ? await requireStaff() : await requireUser();
      const params = (await (ctx?.params ?? Promise.resolve({}))) as P;
      const out = await h(req, { params, user });
      if (out instanceof Response) return out;
      return Response.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) return Response.json({ error: e.issues[0]?.message ?? "Dados inválidos", issues: e.issues }, { status: 400 });
      console.error(e);
      return Response.json({ error: "Erro interno" }, { status: 500 });
    }
  };
}
export const body = (req: NextRequest) => req.json().catch(() => { throw new HttpError(400, "JSON inválido"); });
