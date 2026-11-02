/**
 * Cria (ou redefine a senha de) uma conta de administrador.
 * Uso: ADMIN_EMAIL=voce@org.com [ADMIN_PASSWORD=...] npm run create-admin -w apps/web
 * Sem ADMIN_PASSWORD, gera uma senha aleatória e a exibe uma única vez.
 */
import { randomBytes } from "node:crypto";
import { one, pool, q } from "../lib/db";
import { hashPassword } from "../lib/crypto";
import { register } from "../lib/services/accounts";
import { audit } from "../lib/services/audit";
process.loadEnvFile?.(".env.local");

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!email) throw new Error("Defina ADMIN_EMAIL");
  const generated = !process.env.ADMIN_PASSWORD;
  const pw = process.env.ADMIN_PASSWORD ?? randomBytes(12).toString("base64url");
  if (pw.length < 10) throw new Error("A senha precisa ter ao menos 10 caracteres");
  let u = await one<{ id: string }>("SELECT id FROM users WHERE lower(email)=$1", [email]);
  if (!u) u = { id: await register({ email, password: pw, displayName: process.env.ADMIN_NAME, acceptTerms: true }) };
  else await q("UPDATE users SET password_hash=$2 WHERE id=$1", [u.id, await hashPassword(pw)]);
  await q("UPDATE users SET role='admin' WHERE id=$1", [u.id]);
  await audit(null, "admin.provision", "user", u.id);
  console.log(`Administrador: ${email}`);
  if (generated) console.log(`Senha gerada (exibida só agora; troque rodando o comando de novo com ADMIN_PASSWORD): ${pw}`);
}
main().then(() => pool().end()).catch((e) => { console.error(e.message); process.exit(1); });
