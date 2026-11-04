-- Fila de push segura para múltiplos executores: reserva (lease) atômica, tentativas e backoff.
-- Aditiva e idempotente em estrutura; o código antigo continua funcionando com estas colunas.
ALTER TABLE push_outbox
  ADD COLUMN IF NOT EXISTS attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now();
DROP INDEX IF EXISTS push_outbox_pending_idx;
CREATE INDEX push_outbox_pending_idx ON push_outbox (next_attempt_at, id) WHERE status = 'pending';
