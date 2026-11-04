# Funções comuns. Nada aqui imprime segredos.
set -euo pipefail
umask 077
set +o history 2>/dev/null || true
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PG_IMAGE="${PG_IMAGE:-postgres:17}"
SB_HOST="aws-1-sa-east-1.pooler.supabase.com"   # Session pooler (IPv4); conexão direta é só IPv6
SB_PORT=5432
SB_USER="${SB_ROLE:-postgres}.ctqocxdsiovtgwumslgt"
SB_DB=postgres
CA="$HERE/supabase-ca.crt"
COUNT_SQL="select table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text::bigint from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1"

make_passfile() {   # pgpass temporário (0600): lê de SB_PASS_FILE ou pede a senha sem eco
  PASSFILE="$(mktemp)"; trap 'shred -u "$PASSFILE" 2>/dev/null || rm -f "$PASSFILE"' EXIT
  local pw esc
  if [[ -n "${SB_PASS_FILE:-}" ]]; then pw="$(<"$SB_PASS_FILE")"
  else read -rsp "Senha do banco Supabase (não será exibida): " pw; echo; fi
  [[ -n "$pw" ]] || { echo "Senha vazia." >&2; exit 1; }
  esc=${pw//\\/\\\\}; esc=${esc//:/\\:}
  printf '%s:%s:%s:%s:%s\n' "$SB_HOST" "$SB_PORT" "$SB_DB" "$SB_USER" "$esc" > "$PASSFILE"; unset pw esc
}
sb() {  # executa um binário do cliente PG 17 contra o Supabase, com TLS verify-full
  docker run --rm -i --network host -u "$(id -u):$(id -g)" -e HOME=/tmp \
    -v "$PASSFILE:/pgpass:ro" -v "$CA:/ca.crt:ro" -v "${OUT_DIR:-/tmp}:/out" \
    -e PGPASSFILE=/pgpass -e PGSSLMODE=verify-full -e PGSSLROOTCERT=/ca.crt \
    -e PGHOST="$SB_HOST" -e PGPORT="$SB_PORT" -e PGUSER="$SB_USER" -e PGDATABASE="$SB_DB" \
    -e PGAPPNAME=jornada-migracao "$PG_IMAGE" "$@"
}
