-- Indicações externas ("Saiba mais"): apenas metadados + link para a fonte original.
-- Nenhum texto/áudio de terceiros é copiado; o conteúdo abre no site de origem.
CREATE TABLE resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('article','podcast_episode','podcast_program','blog','site','video')),
  source text NOT NULL,                       -- ex.: "Blog do Bispo Macedo", "Palavra Amiga"
  title text NOT NULL,
  url text NOT NULL UNIQUE CHECK (url ~ '^https://([a-z0-9-]+\.)*universal\.org/'),
  blurb text,                                 -- descrição curta escrita pela equipe (não é cópia da fonte)
  published_on date,
  audiences text[] NOT NULL DEFAULT '{}' CHECK (audiences <@ ARRAY['homens','mulheres','criancas','jovens','familia','casais','geral']::text[]),
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
CREATE TABLE resource_topics (
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  suggested boolean NOT NULL DEFAULT true,
  PRIMARY KEY (resource_id, topic_id)
);
CREATE INDEX resource_topics_topic_idx ON resource_topics (topic_id);
ALTER TABLE editorial_reviews DROP CONSTRAINT IF EXISTS editorial_reviews_content_type_check;
ALTER TABLE editorial_reviews ADD CHECK (content_type IN ('journey','reflection','activity','song','resource'));
