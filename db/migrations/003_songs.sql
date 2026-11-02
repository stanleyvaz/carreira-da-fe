-- Letras de músicas: conteúdo complementar, sujeito ao mesmo fluxo editorial.
CREATE TABLE songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  lyrics text NOT NULL,
  source_file text UNIQUE,              -- idempotência da importação
  credits text,                         -- autoria/direitos (a preencher)
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
CREATE TABLE song_topics (
  song_id uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  suggested boolean NOT NULL DEFAULT true,   -- true = sugestão automática ainda não confirmada por humano
  PRIMARY KEY (song_id, topic_id)
);
CREATE INDEX song_topics_topic_idx ON song_topics (topic_id);
ALTER TABLE editorial_reviews DROP CONSTRAINT editorial_reviews_content_type_check;
ALTER TABLE editorial_reviews ADD CHECK (content_type IN ('journey','reflection','activity','song'));
