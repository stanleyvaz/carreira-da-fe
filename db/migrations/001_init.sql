-- Jornada: esquema inicial. Conteúdo editorial: draft → in_review → approved → published → archived.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  display_name text,
  role text NOT NULL DEFAULT 'user'
    CHECK (role IN ('user','admin','editor','reviewer','publisher','analyst')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_uq ON users (lower(email));

CREATE TABLE sessions (
  id_hash text PRIMARY KEY,               -- sha256 do token; o token nunca é armazenado
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE user_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  goal text,
  topic_slugs text[] NOT NULL DEFAULT '{}',
  mode text NOT NULL DEFAULT 'read' CHECK (mode IN ('read','listen')),
  daily_minutes int NOT NULL DEFAULT 3 CHECK (daily_minutes IN (1,3,5,10)),
  reminder_time time,
  onboarded boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('terms','privacy','personalization','aggregate_analytics')),
  granted boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_consents_idx ON user_consents (user_id, purpose, created_at DESC);

CREATE TABLE notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  quiet_start time NOT NULL DEFAULT '21:00',
  quiet_end time NOT NULL DEFAULT '07:00',
  max_per_week int NOT NULL DEFAULT 3 CHECK (max_per_week BETWEEN 0 AND 7)
);

-- Camada bíblica independente da interface
CREATE TABLE bible_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  edition text NOT NULL,
  license text NOT NULL,                  -- licença/autorização de uso (obrigatório)
  distribution_allowed boolean NOT NULL DEFAULT false
);

CREATE TABLE bible_passages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  translation_id uuid NOT NULL REFERENCES bible_translations(id),
  book text NOT NULL,
  chapter int NOT NULL CHECK (chapter > 0),
  verse_start int NOT NULL CHECK (verse_start > 0),
  verse_end int NOT NULL,
  text text,                              -- NULL = apenas referência (sem texto licenciado)
  CHECK (verse_end >= verse_start),
  UNIQUE (translation_id, book, chapter, verse_start, verse_end)
);

CREATE TABLE topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0
);

-- Campos editoriais comuns repetidos nas três tabelas de conteúdo publicável
CREATE TABLE learning_journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES topics(id),
  title text NOT NULL,
  summary text,
  days int NOT NULL CHECK (days IN (3,5,7,14)),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','published','archived')),
  version int NOT NULL DEFAULT 1,
  author_id uuid REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status NOT IN ('approved','published') OR approved_by IS NOT NULL)
);
CREATE INDEX journeys_topic_status_idx ON learning_journeys (topic_id, status);

CREATE TABLE journey_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES learning_journeys(id) ON DELETE CASCADE,
  position int NOT NULL CHECK (position > 0),
  title text NOT NULL,
  passage_id uuid REFERENCES bible_passages(id),
  context text,
  explanation text,
  application text,
  extra text,
  audio_url text,
  UNIQUE (journey_id, position)
);

CREATE TABLE comprehension_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id uuid NOT NULL REFERENCES journey_steps(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  options text[] NOT NULL,
  correct_index int NOT NULL,
  explanation text,
  CHECK (array_length(options,1) >= 2 AND correct_index >= 0 AND correct_index < array_length(options,1))
);
CREATE INDEX questions_step_idx ON comprehension_questions (step_id);

CREATE TABLE reflections (          -- conteúdo diário
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid REFERENCES topics(id),
  publish_date date,
  passage_id uuid REFERENCES bible_passages(id),
  title text NOT NULL,
  body text NOT NULL,
  application text,
  question text,
  audio_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','published','archived')),
  version int NOT NULL DEFAULT 1,
  author_id uuid REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status NOT IN ('approved','published') OR approved_by IS NOT NULL)
);
CREATE INDEX reflections_date_idx ON reflections (publish_date, status);

CREATE TABLE practical_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid REFERENCES topics(id),
  title text NOT NULL,
  invitation text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','published','archived')),
  version int NOT NULL DEFAULT 1,
  author_id uuid REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status NOT IN ('approved','published') OR approved_by IS NOT NULL)
);

-- Dados do usuário: sempre filtrados por user_id
CREATE TABLE user_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('reflection','step','activity')),
  ref_id uuid NOT NULL,
  journey_id uuid REFERENCES learning_journeys(id) ON DELETE CASCADE,
  answer_index int,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, ref_id)
);
CREATE INDEX user_progress_idx ON user_progress (user_id, completed_at DESC);

CREATE TABLE user_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  passage_id uuid NOT NULL REFERENCES bible_passages(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, passage_id)
);

CREATE TABLE private_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ref_kind text CHECK (ref_kind IN ('reflection','step','activity')),
  ref_id uuid,
  body_enc text NOT NULL,              -- AES-256-GCM (aplicação); servidor de BD nunca vê o texto
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX private_notes_idx ON private_notes (user_id, updated_at DESC);

-- Governança editorial
CREATE TABLE editorial_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL CHECK (content_type IN ('journey','reflection','activity')),
  content_id uuid NOT NULL,
  reviewer_id uuid NOT NULL REFERENCES users(id),
  decision text NOT NULL CHECK (decision IN ('approved','changes_requested')),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE content_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL,
  content_id uuid NOT NULL,
  version int NOT NULL,
  snapshot jsonb NOT NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (content_type, content_id, version)
);

CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY,
  actor_id uuid,                        -- sem FK: o log sobrevive à exclusão de conta
  action text NOT NULL,
  entity text,
  entity_id text,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_idx ON audit_logs (created_at DESC);

CREATE TABLE rate_limits (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);
