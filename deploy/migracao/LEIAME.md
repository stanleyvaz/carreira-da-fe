# Migração Supabase → servidor Linux (Carreira da Fé)

Levantamento (02/11/2026, somente leitura):
- Supabase `jornada` (ref `ctqocxdsiovtgwumslgt`), sa-east-1, Free/Nano, status Healthy, **PostgreSQL 17.11**, banco ~31 MB, 30 tabelas em `public`.
- Extensões: pgcrypto, uuid-ossp, pg_stat_statements, supabase_vault, plpgsql. A app só usa `public` (usa `gen_random_uuid()` do core).
- Conexão direta: `db.ctqocxdsiovtgwumslgt.supabase.co:5432` (só IPv6). Para IPv4: Session pooler `aws-1-sa-east-1.pooler.supabase.com:5432`, usuário `postgres.ctqocxdsiovtgwumslgt`, banco `postgres`, TLS verify-full com `supabase-ca.crt`.
- Plano Free: **sem backups** no Supabase.
- `private_notes` = 0 linhas: nenhum dado cifrado depende hoje da NOTES_ENCRYPTION_KEY.
- Vercel `jornada-cms`: DATABASE_URL e NOTES_ENCRYPTION_KEY marcadas como Sensitive (valor não legível). A chave original só existe no cofre onde foi guardada.

Execução (no servidor, como usuário com acesso ao Docker):
1. `scp -r deploy/migracao usuario@servidor:~/jornada-migracao-scripts`
2. `ssh usuario@servidor` → `cd ~/jornada-migracao-scripts`
3. `./01_exportar_supabase.sh` — pede a senha do banco sem eco; gera public.dump, full.dump, counts_source.tsv, SHA256SUMS (dir 700).
4. `PG_CONTAINER=<container pg17> PG_USER=<usuario> ./02_restaurar_import.sh ~/jornada-migracao/<timestamp>` — restaura em banco NOVO `jornada_import` e compara contagens.
5. `ENV_FILE=<arquivo .env do compose> ./03_configurar_chave_notas.sh` — cola a chave original do cofre, sem eco.

Não feito nesta etapa (exige aprovação): apontar a app para `jornada_import`/renomear bancos, congelar escrita na produção para o corte final, DNS, iOS.

6. `./04_promover.sh ~/jornada-migracao/<timestamp>` — renomeia o `carreira` vazio para `carreira_vazio_AAAAMMDD`, promove `jornada_import` a `carreira`, aplica as permissões do `initdb/10-roles.sh` e valida contagens. Reversível (o script imprime o comando).
