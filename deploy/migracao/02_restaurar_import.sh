#!/usr/bin/env bash
# Restaura public.dump num banco NOVO (jornada_import) do PostgreSQL 17 local. Não toca no banco atual.
# Uso: PG_CONTAINER=<container> PG_USER=<usuario> ./02_restaurar_import.sh /caminho/<timestamp>
source "$(dirname "$0")/lib.sh"
DIR="${1:?informe o diretório da exportação}"; IMPORT_DB="${IMPORT_DB:-jornada_import}"
: "${PG_CONTAINER:?defina PG_CONTAINER}"; PG_USER="${PG_USER:-postgres}"
(cd "$DIR" && sha256sum -c --quiet SHA256SUMS) && echo "Integridade OK."
x() { docker exec -i "$PG_CONTAINER" "$@"; }
if x psql -XAtU "$PG_USER" -d postgres -c "select 1 from pg_database where datname='$IMPORT_DB'" | grep -q 1; then
  echo "O banco $IMPORT_DB já existe. Renomeie/remova manualmente ou use IMPORT_DB=outro_nome." >&2; exit 1; fi
x createdb -U "$PG_USER" "$IMPORT_DB"
# o dump do schema public já traz CREATE SCHEMA public; o banco recém-criado é esvaziado antes
x psql -XqU "$PG_USER" -d "$IMPORT_DB" -v ON_ERROR_STOP=1 -c 'DROP SCHEMA public; CREATE SCHEMA IF NOT EXISTS extensions; CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions; CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;'
x pg_restore -U "$PG_USER" -d "$IMPORT_DB" --no-owner --no-privileges --exit-on-error < "$DIR/public.dump"
printf '%s;\n' "$COUNT_SQL" | x psql -XAqt -F $'\t' -U "$PG_USER" -d "$IMPORT_DB" > "$DIR/counts_import.tsv"
if diff -u "$DIR/counts_source.tsv" "$DIR/counts_import.tsv"; then
  echo "OK: contagens idênticas em $(wc -l < "$DIR/counts_import.tsv") tabelas (banco $IMPORT_DB)."
else echo "DIVERGÊNCIA nas contagens — não promova este banco." >&2; exit 1; fi
