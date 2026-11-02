/** Processa a fila de push (envia pendências, inclusive as adiadas pelo horário de silêncio). Rode a cada ~5 min. */
import { pool } from "../lib/db";
import { processOutbox } from "../lib/services/notifications";
process.loadEnvFile?.(".env.local");
processOutbox().then((r) => { console.log(r); return pool().end(); }).catch((e) => { console.error(e); process.exit(1); });
