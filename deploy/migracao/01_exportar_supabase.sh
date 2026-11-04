#!/usr/bin/env bash
# Exporta o banco de produção do Supabase SOMENTE LEITURA (pg_dump usa snapshot; nada é alterado).
# Uso no servidor:  OUT_BASE=/srv/jornada/migracao ./01_exportar_supabase.sh
source "$(dirname "$0")/lib.sh"
OUT_DIR="${OUT_BASE:-$HOME/jornada-migracao}/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$OUT_DIR"; chmod 700 "$OUT_DIR"
make_passfile
v=$(sb psql -XAtc "select current_setting('server_version_num')")
[[ $v == 17* ]] || { echo "Versão inesperada no Supabase: $v" >&2; exit 1; }
echo "Supabase PostgreSQL $v — conexão TLS verificada."
echo "1/3 dump do schema public (restauração)..."
sb pg_dump -Fc -Z6 --schema=public --no-owner --no-privileges -f /out/public.dump
echo "2/3 dump integral (arquivo de segurança; schemas gerenciados podem gerar avisos)..."
sb pg_dump -Fc -Z6 --no-owner --no-privileges -f /out/full.dump 2>"$OUT_DIR/full_dump.stderr" \
  || echo "  aviso: dump integral incompleto (ver full_dump.stderr); o dump public é o que será restaurado."
echo "3/3 contagem exata de linhas (transação read-only)..."
printf 'BEGIN READ ONLY;\n%s;\nCOMMIT;\n' "$COUNT_SQL" | sb psql -XAqt -F $'\t' -v ON_ERROR_STOP=1 > "$OUT_DIR/counts_source.tsv"
(cd "$OUT_DIR" && sha256sum *.dump counts_source.tsv > SHA256SUMS)
echo "Pronto: $OUT_DIR  ($(wc -l < "$OUT_DIR/counts_source.tsv") tabelas)"; ls -la "$OUT_DIR"
