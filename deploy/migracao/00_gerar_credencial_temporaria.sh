#!/usr/bin/env bash
# Gera uma senha aleatória para o papel temporário de leitura no Supabase.
# A senha fica só em ~/.jornada-dump-pass (0600). Na tela sai apenas o verificador SCRAM,
# que permite ao Supabase conferir a senha mas não serve para fazer login.
set -euo pipefail; umask 077; set +o history 2>/dev/null || true
F="${SB_PASS_FILE:-$HOME/.jornada-dump-pass}"
[[ -s "$F" ]] || openssl rand -hex 24 > "$F"; chmod 600 "$F"
PYCODE='import sys,os,hashlib,hmac,base64
pw=open(sys.argv[1]).read().strip().encode(); salt=os.urandom(16); it=4096
s=hashlib.pbkdf2_hmac("sha256",pw,salt,it)
ck=hmac.new(s,b"Client Key","sha256").digest(); sk=hmac.new(s,b"Server Key","sha256").digest()
b=lambda x: base64.b64encode(x).decode()
print(f"SCRAM-SHA-256${it}:{b(salt)}${b(hashlib.sha256(ck).digest())}:{b(sk)}")'
if command -v python3 >/dev/null; then V=$(python3 -c "$PYCODE" "$F")
else V=$(docker run --rm -i -v "$F:/p:ro" python:3.12-alpine python -c "$PYCODE" /p); fi
echo "Senha salva em $F (0600). Verificador para o Supabase:"
echo "$V"
