-- Gestão de usuários pelo CMS e métricas de uso anônimas (LGPD: minimização e agregação).

-- Bloqueio reversível e troca de senha obrigatória (contas criadas/redefinidas pelo CMS).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- Atividade diária: só a data (fuso de Brasília). Dado operacional; some com a conta.
CREATE TABLE IF NOT EXISTS user_activity_days (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day date NOT NULL,
  PRIMARY KEY (user_id, day)
);
CREATE INDEX IF NOT EXISTS user_activity_days_day_idx ON user_activity_days (day);

-- Geografia agregada: pessoas únicas por dia, país e UF. Sem vínculo com usuário e sem IP.
CREATE TABLE IF NOT EXISTS geo_daily (
  day date NOT NULL,
  country text NOT NULL,          -- ISO 3166-1 alfa-2 ou '??'
  region text NOT NULL DEFAULT '', -- UF/subdivisão ou ''
  users int NOT NULL DEFAULT 0,
  PRIMARY KEY (day, country, region)
);

-- Aberturas de conteúdo agregadas por dia (contagem de visualizações, sem usuário).
CREATE TABLE IF NOT EXISTS content_daily (
  day date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('journey','step','resource')),
  content_id uuid NOT NULL,
  opens int NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind, content_id)
);

-- Tempo por área do app: só de quem consentiu ('aggregate_analytics'). Sem user_id, sem IP.
CREATE TABLE IF NOT EXISTS area_time_daily (
  day date NOT NULL,
  area text NOT NULL CHECK (area IN ('hoje','aprender','exercitar','minha','favoritos','perfil')),
  visits int NOT NULL DEFAULT 0,
  seconds bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (day, area)
);

-- Frases da ovelhinha (personagem do app), editáveis no CMS.
-- Categorias: saudação por período/estado, toque, agradecimento (após concluir) e passeio (ocioso).
-- "{nome}" é trocado pelo nome da pessoa (ou removido, com a vírgula, se não houver nome).
CREATE TABLE IF NOT EXISTS companion_phrases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('greeting_morning','greeting_afternoon','greeting_evening','greeting_done','greeting_default','poke','thanks','idle')),
  text text NOT NULL CHECK (char_length(text) BETWEEN 2 AND 140),
  enabled boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS companion_phrases_cat_idx ON companion_phrases (category, enabled, sort_order);

INSERT INTO companion_phrases (category, text, enabled, sort_order)
SELECT v.category, v.text, true, v.ord FROM (VALUES
  ('greeting_morning',   'Bom dia, {nome}! Vamos ler a Palavra de hoje?', 1),
  ('greeting_afternoon', 'Boa tarde, {nome}! A reflexão de hoje está te esperando.', 1),
  ('greeting_evening',   'Boa noite, {nome}. Um minutinho com a Palavra antes de dormir?', 1),
  ('greeting_done',      'Hoje já foi lindo, {nome}. Pode descansar comigo.', 1),
  ('greeting_default',   'Oi, {nome}! Que bom te ver. 🐑', 1),
  ('poke', 'Béé! 🐑', 1), ('poke', 'Cosquinha! Hihi', 2), ('poke', 'Sem pressa, eu estou aqui.', 3),
  ('poke', 'Respira fundo comigo… 🌿', 4), ('poke', 'Você está indo bem.', 5), ('poke', 'Que tal um versículo?', 6),
  ('poke', 'Gosto quando você aparece.', 7),
  ('thanks', 'Que alegria! 💛', 1), ('thanks', 'Obrigada por caminhar comigo!', 2), ('thanks', 'Eu senti isso aqui no coração.', 3),
  ('idle', 'O dia está lindo, não está?', 1), ('idle', 'Estou pastando um pouquinho… 🌼', 2),
  ('idle', 'Deus cuida de cada detalhe.', 3), ('idle', 'Quando quiser, eu estou aqui.', 4)
) AS v(category, text, ord)
WHERE NOT EXISTS (SELECT 1 FROM companion_phrases);
