-- Desafios, destaque (promoção) e janelas de tempo
ALTER TABLE learning_journeys
  ADD COLUMN kind text NOT NULL DEFAULT 'journey' CHECK (kind IN ('journey','challenge')),
  ADD COLUMN featured boolean NOT NULL DEFAULT false,
  ADD COLUMN feature_headline text,
  ADD COLUMN feature_until timestamptz,
  ADD COLUMN starts_at date,
  ADD COLUMN ends_at date;
ALTER TABLE learning_journeys DROP CONSTRAINT learning_journeys_days_check;
ALTER TABLE learning_journeys ADD CONSTRAINT learning_journeys_days_check CHECK (days BETWEEN 3 AND 40);
-- no máximo um item em destaque por vez
CREATE UNIQUE INDEX one_featured_journey ON learning_journeys ((true)) WHERE featured;
ALTER TABLE learning_journeys ADD CONSTRAINT featured_requires_published CHECK (NOT featured OR status = 'published');
