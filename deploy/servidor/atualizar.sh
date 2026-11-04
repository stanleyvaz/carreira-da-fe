#!/usr/bin/env bash
# Atualiza o CMS no dseserver: backup → código (main) → migrações pendentes → base GeoIP → imagem nova → saúde.
# Uso (no servidor): ~/carreira-da-fe/deploy/servidor/atualizar.sh
# Reverter a app: docker tag carreira-da-fe-web:<tag-impressa> carreira-da-fe-web:local && docker compose up -d web
set -euo pipefail
APP="$HOME/carreira-da-fe"; DEP="$HOME/carreira-da-fe-deploy"; TAG="pre-$(date +%Y%m%d%H%M)"
psqlc() { docker exec -i carreira-db psql -XqU carreira_owner -d carreira -v ON_ERROR_STOP=1 "$@"; }

echo "1/6 backup do banco"; (cd "$DEP" && ./backup.sh | tail -1)

echo "2/6 código"; cd "$APP"; git fetch -q origin; git merge --ff-only -q origin/main; git log --oneline -1

echo "3/6 migrações pendentes"
for f in db/migrations/*.sql; do
  n=$(basename "$f")
  if [[ -z "$(psqlc -At -c "SELECT 1 FROM schema_migrations WHERE name='$n'")" ]]; then
    { echo "BEGIN;"; cat "$f"; echo "INSERT INTO schema_migrations(name) VALUES ('$n');"; echo "COMMIT;"; } | psqlc && echo "  aplicada: $n"
  fi
done

echo "4/6 base GeoIP (DB-IP City Lite, CC BY 4.0; atualiza se tiver mais de 35 dias)"
G="$DEP/geoip"; DB="$G/dbip-city-lite.mmdb"; mkdir -p "$G"
if [[ ! -s "$DB" || -n "$(find "$DB" -mtime +35 2>/dev/null)" ]]; then
  tmp=$(mktemp -d)
  for m in "$(date +%Y-%m)" "$(date -d '-1 month' +%Y-%m)"; do
    if curl -fsSL "https://download.db-ip.com/free/dbip-city-lite-$m.mmdb.gz" -o "$tmp/db.gz"; then gunzip -c "$tmp/db.gz" > "$tmp/db.mmdb" && mv "$tmp/db.mmdb" "$DB" && echo "  base $m instalada"; break; fi
  done
  rm -rf "$tmp"
fi
chmod 644 "$DB" 2>/dev/null || echo "  aviso: sem base GeoIP; país/UF ficarão como 'não identificado'"

echo "5/6 compose (GEOIP_DB e volume, uma vez só)"
if ! grep -q "GEOIP_DB" "$DEP/compose.yaml"; then
  cp "$DEP/compose.yaml" "$DEP/compose.yaml.bak-$(date +%Y%m%d%H%M)"
  python3 - "$DEP/compose.yaml" <<'PY'
import sys
p = sys.argv[1]; lines = open(p).read().split("\n"); out = []; in_web = False; env_done = vol_done = False
for l in lines:
    if l.startswith("  ") and not l.startswith("    ") and l.strip().endswith(":"): in_web = l.strip() == "web:"
    if in_web and not vol_done and l.strip() == "ports:" and l.startswith("    ") and not l.startswith("      "):
        out += ["    volumes:", "      - ./geoip:/geoip:ro"]; vol_done = True
    out.append(l)
    if in_web and not env_done and l.strip() == "environment:" and l.startswith("    ") and not l.startswith("      "):
        out.append("      GEOIP_DB: /geoip/dbip-city-lite.mmdb"); env_done = True
assert env_done and vol_done, "não achei environment/ports no serviço web"
open(p, "w").write("\n".join(out))
PY
  echo "  compose atualizado (cópia .bak criada)"
fi

echo "6/6 imagem nova"; cd "$DEP"
docker tag carreira-da-fe-web:local "carreira-da-fe-web:$TAG"; echo "  imagem anterior: carreira-da-fe-web:$TAG"
docker compose build web >/tmp/build-web.log 2>&1 || { tail -20 /tmp/build-web.log; exit 1; }
docker compose up -d web
for i in $(seq 1 30); do [[ "$(docker inspect -f '{{.State.Health.Status}}' carreira-web)" == healthy ]] && break; sleep 3; done
docker compose ps --format '{{.Service}}\t{{.Status}}'
curl -sS -o /dev/null -w "  GET / %{http_code}\n" http://127.0.0.1:3100/
curl -sS -o /dev/null -w "  login inválido %{http_code} (esperado 401)\n" -H 'content-type: application/json' -H 'Origin: https://dseserver.tail70feec.ts.net' \
  -d '{"email":"teste-inexistente@invalido.local","password":"x-invalida"}' http://127.0.0.1:3100/api/auth/login
curl -sS -o /dev/null -w "  frases sem login %{http_code} (esperado 401)\n" http://127.0.0.1:3100/api/companion/phrases
docker logs --since 2m carreira-web 2>&1 | grep -i -E "error|erro" | grep -v -i "não autenticado" | head -5 || true
echo "OK."
