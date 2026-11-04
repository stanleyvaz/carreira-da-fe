# Roteiro da troca (Vercel/Supabase -> dseserver)

Preparação (Mac): `npx vercel@latest login`; `which xcodegen || brew install xcodegen`.

1. Servidor: `./00_gerar_credencial_temporaria.sh` -> enviar o verificador ao Claude (cria o papel migracao_ro no Supabase).
2. Servidor: `cd ~/carreira-da-fe-deploy && docker compose stop web`  (início da janela, ~5 min fora do ar)
3. Mac: `cd ~/Documents/Claude/jornada/deploy/vercel-redirect && npx vercel@latest deploy --prod`  (Vercel passa a encaminhar ao servidor)
4. Servidor: `cd ~/jornada-migracao-scripts && SB_ROLE=migracao_ro SB_PASS_FILE=~/.jornada-dump-pass ./01_exportar_supabase.sh`
5. Servidor: `./05_ressincronizar.sh ~/jornada-migracao/<pasta nova>`  (confere private_notes = 0)
6. Servidor: `cd ~/carreira-da-fe-deploy && docker compose start web && shred -u ~/.jornada-dump-pass`  (fim da janela)
7. Claude: remove migracao_ro do Supabase e testa as duas URLs.
8. Mac: `cd ~/Documents/Claude/jornada/ios && xcodegen generate && open Jornada.xcodeproj` -> Product > Archive -> Distribute App -> App Store Connect -> Upload (build 7).

Reverter: Vercel -> Instant Rollback para o deploy anterior; servidor -> comando de reversão impresso pelo 05.
