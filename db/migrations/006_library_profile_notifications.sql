-- Biblioteca: conteúdo guardado no nosso banco (editável no CMS); o link vira "fonte original".
CREATE TABLE media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('avatar','content')),
  owner_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  mime text NOT NULL CHECK (mime IN ('image/jpeg','image/png','image/webp')),
  bytes bytea NOT NULL CHECK (octet_length(bytes) <= 3145728),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN avatar_media_id uuid REFERENCES media(id) ON DELETE SET NULL;
ALTER TABLE resources
  ADD COLUMN body text,
  ADD COLUMN image_media_id uuid REFERENCES media(id) ON DELETE SET NULL,
  ADD COLUMN audio_url text,
  ADD COLUMN video_url text,
  ADD COLUMN author_name text,
  ADD COLUMN synced_at timestamptz,
  ADD CONSTRAINT resources_audio_https CHECK (audio_url IS NULL OR audio_url ~ '^https://'),
  ADD CONSTRAINT resources_video_https CHECK (video_url IS NULL OR video_url ~ '^https://');

-- Notificações
ALTER TABLE notification_preferences
  ADD COLUMN reading_reminder boolean NOT NULL DEFAULT true,   -- "hora da Palavra" no horário escolhido
  ADD COLUMN nudge boolean NOT NULL DEFAULT false,             -- lembrete gentil se o dia ainda não foi feito
  ADD COLUMN new_content boolean NOT NULL DEFAULT true;        -- avisos de novos conteúdos enviados pelo CMS
CREATE TABLE devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('ios','android','web')),
  token text NOT NULL,
  env text NOT NULL DEFAULT 'production' CHECK (env IN ('sandbox','production')),
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, token)
);
CREATE INDEX devices_user_idx ON devices (user_id);
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 80),
  body text NOT NULL CHECK (char_length(body) BETWEEN 3 AND 240),
  link_kind text NOT NULL DEFAULT 'none' CHECK (link_kind IN ('none','resource','journey','today','praticar')),
  link_id uuid,
  target text NOT NULL DEFAULT 'all' CHECK (target IN ('all','topic')),
  topic_slug text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent')),
  created_by uuid REFERENCES users(id),
  sent_by uuid REFERENCES users(id),
  sent_at timestamptz,
  recipients int,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (target <> 'topic' OR topic_slug IS NOT NULL),
  CHECK (link_kind NOT IN ('resource','journey') OR link_id IS NOT NULL),
  CHECK (status <> 'sent' OR sent_by IS NOT NULL)
);
CREATE TABLE notification_inbox (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  PRIMARY KEY (user_id, notification_id)
);
CREATE TABLE push_outbox (
  id bigserial PRIMARY KEY,
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX push_outbox_pending_idx ON push_outbox (status) WHERE status = 'pending';
