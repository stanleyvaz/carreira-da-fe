# Jornada — A Palavra no seu dia

Monorepo: `apps/web` (Next.js: app responsivo, `/admin` e API REST), `packages/shared` (tipos, validação, regras), `db/migrations` (SQL).

## Executar
```bash
npm install
createdb jornada_dev && createdb jornada_test
cp apps/web/.env.example apps/web/.env.local   # preencher NOTES_ENCRYPTION_KEY: openssl rand -base64 32
npm run migrate
npm run seed                                   # temas
npm run import-bible -w apps/web -- ../../bible/ACF.rvbible   # ACF completa (31.105 versículos)
npm run import-content -w apps/web             # conteúdo editorial (content/*.json) EM REVISÃO
ADMIN_EMAIL=voce@org.com npm run create-admin -w apps/web   # cria o administrador (senha aleatória exibida uma vez)
npm run dev                                    # http://localhost:3000   (/admin para o CMS)
npm test                                       # 18 testes (autorização, isolamento, cifragem, fluxo editorial, LGPD)
```

## Decisões
- SQL puro + `pg`; autorização na camada de serviço (`apps/web/lib/services`), sempre por `user_id`.
- Autenticação própria (scrypt + sessão opaca, só o hash é gravado; cookie httpOnly ou `Authorization: Bearer` para mobile). Trocável por provedor gerenciado.
- Notas privadas cifradas com AES-256-GCM na aplicação. Exclusão de conta em cascata; exportação em `/api/me/export`.
- Publicação exige aprovação por outro perfil (regra no serviço **e** `CHECK` no banco). Gabarito das perguntas nunca vai ao cliente.
- Sem IA no MVP; contrato `BibleAssistant` em `packages/shared`.

## Pendências (exigem decisão/credenciais)
1. **Licença da ACF**: direitos declarados pela instituição; anexar o instrumento de licença ao dossiê (campo `bible_translations.license`).
1b. **Músicas** (`npm run import-music -w apps/web -- ../../music`): 1.804 letras entram como *rascunho* com temas apenas *sugeridos* por palavras-chave. Cada uma precisa de tema confirmado, créditos/autoria e aprovação humana antes de aparecer em "Louvor relacionado". Confirmar direitos de uso das letras.
2. **Revisão doutrinária humana** de todo conteúdo; o conteúdo `[DEMO]` não é material aprovado.
3. **Validação jurídica/DPO**: bases legais LGPD, termos, política de privacidade, retenção.
4. Provedor de autenticação gerenciado, e-mail transacional (recuperação de senha, ainda não implementada), hospedagem, backups do PostgreSQL, gestão de segredos, rate limit distribuído.
5. Editor visual de etapas no CMS (hoje via `PUT /api/admin/journeys/:id/steps`); upload de áudio; consentimento explícito de métricas agregadas (UI).
6. App Expo (`apps/mobile`), offline/sincronização, notificações, recomendações avançadas e RAG: fases 2 e 3.

## App iOS (SwiftUI nativo, `ios/`)
```bash
brew install xcodegen            # uma vez
cd ios && xcodegen generate      # gera Jornada.xcodeproj a partir de project.yml
open Jornada.xcodeproj           # ⌘R no simulador (API em http://localhost:3000 — mantenha `npm run dev`)
```
iOS 17+, Liquid Glass automático no iOS 26+. Sessão no Keychain (Bearer). Sons sintetizados em `ios/Jornada/Resources/Sounds` (tap, select, success, complete, bookmark, gentle, welcome), com opção "Sons e vibração" em Minha jornada; respeita modo silencioso e "Reduzir movimento".
Debug: `SIMCTL_CHILD_JORNADA_DEBUG_LOGIN=email:senha` faz login automático (somente builds DEBUG). Release usa `API_BASE_URL` de `project.yml` (definir o domínio real).

## Conteúdo e CMS (`/admin`)
- `apps/web/content/` traz as jornadas, o desafio, as reflexões e os exercícios. O import cria tudo **em revisão** (nunca publicado): aprovação e publicação são ações humanas no CMS (individuais ou em lote).
- Perfis: admin, editor, revisor, publicador, analista. O autor não aprova o próprio conteúdo. Itens importados não têm autor, então qualquer revisor pode aprová-los.
- CMS: painel por status, listas com filtro/busca/lote, editor visual de jornadas e desafios (etapas, versículo ACF verificado, pergunta), duplicar, excluir rascunho, temas, equipe/perfis, indicadores, auditoria.
- Desafio = jornada com `kind=challenge` e janela opcional de datas. **Promover** (Painel → Destaque): um único item publicado por vez aparece na tela Hoje do app, com chamada e prazo opcionais; arquivar remove o destaque.
- Todo conteúdo gerado precisa de **revisão doutrinária humana** antes de publicar (notas dos redatores sobre pontos sensíveis: ver o histórico desta entrega).

### Ícone do app
`ios/Jornada/Icon/AppIcon.icon` é um pacote do Icon Composer em camadas (fundo, fita, Bíblia de couro, anéis em vidro). Regenerar as camadas: `swift ios/Tools/make_icon.swift` (também grava `ios/Tools/preview.png`, aproximação sem o vidro). Abra o `.icon` no Xcode/Icon Composer para ajustar vidro, translucidez e variantes escura/monocromática.

## Indicações externas ("Saiba mais")
- Conteúdo de universal.org (blogs, podcasts, sites por público) entra **apenas como indicação**: título, descrição curta nossa e link que abre no site de origem. Nenhum texto/áudio de terceiros é copiado ou reproduzido.
- Tabelas `resources` / `resource_topics` (migração 005), mesmo fluxo editorial; o banco só aceita links `https` de `universal.org`.
- Públicos: homens, mulheres, crianças, jovens, família, casais, para todos. Aparecem em **Hoje** ("Quer saber mais?", pelo tema da reflexão) e em **Aprender** (filtro por público).
- CMS: *Indicações* no menu. Catálogo inicial: `apps/web/content/resources.json` → `npm run import-resources -w apps/web` (entra **em revisão**; revisor confere tema/público antes de aprovar).
- **Atualização:** a Universal autorizou o uso do conteúdo (confirmado pelo responsável do projeto; guardar o termo). O texto, o autor e a imagem agora ficam no nosso banco (`npm run sync-resources -w apps/web`, 1 req/s, não sobrescreve itens já editados) e são editáveis no CMS (menu *Biblioteca*). O link vira crédito "Ver original". **Áudio e vídeo continuam hospedados na origem** (anchor.fm/YouTube); para independência total é preciso armazenamento de objetos (S3/R2) — decisão de custo/credenciais pendente.
- Pendente: ampliar o catálogo; ampliar o catálogo (os blogs paginam por "Carregar mais", fora do alcance da leitura automática).

## Perfil, lembretes e notificações
- Perfil: foto (JPEG/PNG/WebP validada pelo conteúdo, ≤3 MB, guardada no banco), nome e troca de senha (exige a atual; encerra as outras sessões).
- Lembretes (iOS, locais): hora da Palavra no horário escolhido e lembrete gentil às 19h30 só se a reflexão do dia não foi feita; reagendados a cada abertura do app e ao concluir.
- Avisos do CMS (menu *Notificações*): rascunho → teste no meu aparelho → envio (admin/publisher). Respeita a escolha do usuário, o horário de silêncio e o teto semanal; aparece também em "Novidades" sem push. Cada envio é auditado.
- Push real (APNs): defina `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`, `APNS_KEY_P8` (nunca no repositório) e rode `npm run push-worker -w apps/web` a cada ~5 min (envia o que ficou adiado pelo silêncio). Sem as chaves nada é enviado e o motivo fica registrado. **Não testado contra a Apple.**

## Produção (Vercel + Supabase)
- App/CMS: projeto Vercel `jornada-cms` (time DSE) → https://jornada-cms.vercel.app. Banco: Supabase `jornada` (organização *jornada*, plano Free, São Paulo, Data API desligada). Conexão pelo pooler (`aws-1-sa-east-1`, porta 6543) com TLS verificado pela CA do Supabase (`apps/web/lib/supabaseCa.ts`).
- Variáveis (somente na Vercel, como segredo): `DATABASE_URL`, `NOTES_ENCRYPTION_KEY` (guardar cópia em cofre: sem ela as anotações privadas não abrem). Futuro push: `APNS_*`.
- Dados iniciais carregados com os scripts do repositório (migrations 001–006, temas, Bíblia ACF, conteúdo editorial e biblioteca; tudo "em revisão"). Letras de música **não** foram carregadas (direitos).
- Migrações em produção: `DATABASE_URL=<conexão de sessão, porta 5432> npm run migrate -w apps/web`.
- Pendências conhecidas: o plano Free do Supabase pausa após 7 dias sem uso; Deployment Protection da Vercel precisa ser desligada para acesso público; push (APNs) sem chave.
