import { createCipheriv, createDecipheriv, randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
const scryptAsync = promisify(scrypt) as (p: string, s: Buffer, n: number) => Promise<Buffer>;

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(pw, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}
export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, s, k] = stored.split("$");
  if (alg !== "scrypt" || !s || !k) return false;
  const expected = Buffer.from(k, "base64");
  const key = await scryptAsync(pw, Buffer.from(s, "base64"), expected.length);
  return timingSafeEqual(key, expected);
}
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function key(): Buffer {
  const k = process.env.NOTES_ENCRYPTION_KEY;
  if (!k) throw new Error("NOTES_ENCRYPTION_KEY não configurada");
  const buf = Buffer.from(k, "base64");
  if (buf.length !== 32) throw new Error("NOTES_ENCRYPTION_KEY deve ter 32 bytes (base64)");
  return buf;
}
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}
export function decrypt(payload: string): string {
  const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
