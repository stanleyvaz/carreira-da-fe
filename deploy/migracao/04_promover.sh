#!/usr/bin/env bash
# Promove jornada_import -> carreira, guardando o carreira VAZIO com outro nome. Nada é apagado.
# Uso: ./04_promover.sh ~/jornada-migracao/<timestamp>
source "$(dirname "$0")/lib.sh"
DIR="${1:?informe o diretório da exportação}"
C="${PG_CONTAINER:-carreira-db}"; U="${PG_USER:-carreira_owner}"
DEPLOY="${DEPLOY_DIR:-$HOME/carreira-da-fe-deploy}"; BKP="carreira_vazio_$(date +%Y%m%d)"
q() { docker exec -i "$C" psql -XAtqU "$U" -v ON_ERROR_STOP=1 "$@"; }
die() { echo "ABORTADO: $*" >&2; exit 1; }

echo "1/4 verificações..."
[[ "$(q -d carreira -c "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'")" == 0 ]] \
  || die "o banco carreira não está vazio"
[[ -z "$(q -d postgres -c "select 1 from pg_database where datname='$BKP'")" ]] || die "$BKP já existe"
[[ -z "$(docker ps -q --filter name='^carreira-(web|push-worker)$')" ]] || die "pare web/push-worker antes"
[[ "$(q -d postgres -c "select count(*) from pg_stat_activity where datname in ('carreira','jornada_import') and pid<>pg_backend_pid()")" == 0 ]] \
  || die "há conexões abertas em carreira/jornada_import"
printf '%s;\n' "$COUNT_SQL" | q -F $'\t' -d jornada_import | diff -q "$DIR/counts_source.tsv" - >/dev/null \
  || die "jornada_import diverge do counts_source.tsv"
GRANTS="$(grep -E '^[[:space:]]*(GRANT|REVOKE|ALTER DEFAULT PRIVILEGES)' "$DEPLOY/initdb/10-roles.sh")" || die "permissões não encontradas em initdb/10-roles.sh"

echo "2/4 renomeando bancos (carreira -> $BKP, jornada_import -> carreira)..."
q -d postgres -c "ALTER DATABASE carreira RENAME TO $BKP" -c "ALTER DATABASE jornada_import RENAME TO carreira"

echo "3/4 permissões do carreira_app (mesmas do initdb + objetos já existentes)..."
{ printf '%s\n' "$GRANTS"; cat <<'SQL'
GRANT USAGE ON SCHEMA extensions TO carreira_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO carreira_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO carreira_app;
SQL
} | q -d carreira

echo "4/4 validação..."
printf '%s;\n' "$COUNT_SQL" | q -F $'\t' -d carreira > "$DIR/counts_carreira.tsv"
diff -q "$DIR/counts_source.tsv" "$DIR/counts_carreira.tsv" >/dev/null || die "contagens divergentes após promoção"
n=$(q -d carreira -c "select count(*) from pg_class c join pg_namespace s on s.oid=c.relnamespace where s.nspname='public' and c.relkind in ('r','p') and has_table_privilege('carreira_app', c.oid, 'SELECT') and has_table_privilege('carreira_app', c.oid, 'INSERT') and has_table_privilege('carreira_app', c.oid, 'UPDATE') and has_table_privilege('carreira_app', c.oid, 'DELETE')")
echo "OK: carreira = dados do Supabase ($(wc -l < "$DIR/counts_carreira.tsv") tabelas); carreira_app com acesso a $n tabelas."
echo "Reverter, se necessário (com web parado):"
echo "  docker exec carreira-db psql -U $U -d postgres -c 'ALTER DATABASE carreira RENAME TO jornada_import' -c 'ALTER DATABASE $BKP RENAME TO carreira'"
