import { randomBytes } from "node:crypto";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/jornada_test";
process.env.NOTES_ENCRYPTION_KEY = randomBytes(32).toString("base64");
