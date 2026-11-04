#!/usr/bin/env bash
# Grava a NOTES_ENCRYPTION_KEY ORIGINAL (do cofre) no arquivo de ambiente do servidor, sem eco e sem histórico.
# Uso: ENV_FILE=/srv/jornada/.env.production ./03_configurar_chave_notas.sh
set -euo pipefail; umask 077; set +o history 2>/dev/null || true
ENV_FILE="${ENV_FILE:?defina ENV_FILE (arquivo lido pelo docker compose)}"
read -rsp "Cole a NOTES_ENCRYPTION_KEY original (não será exibida): " K; echo
n=$(printf %s "$K" | base64 -d 2>/dev/null | wc -c) || n=0
[[ "$n" == 32 ]] || { unset K; echo "Chave inválida: precisa ser base64 de 32 bytes." >&2; exit 1; }
touch "$ENV_FILE"; chmod 600 "$ENV_FILE"; tmp="$(mktemp "$ENV_FILE.XXXX")"
K="$K" awk 'BEGIN{done=0} /^NOTES_ENCRYPTION_KEY=/{print "NOTES_ENCRYPTION_KEY=" ENVIRON["K"]; done=1; next} {print} END{if(!done) print "NOTES_ENCRYPTION_KEY=" ENVIRON["K"]}' "$ENV_FILE" > "$tmp"
mv "$tmp" "$ENV_FILE"
echo "Gravada em $ENV_FILE (600). Impressão digital: $(printf %s "$K" | sha256sum | cut -c1-12)"; unset K
