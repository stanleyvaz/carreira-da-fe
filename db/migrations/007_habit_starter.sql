-- Hábito: âncora escolhida pelo usuário ("depois do café") e a jornada "Primeiros 7 dias".
ALTER TABLE user_preferences ADD COLUMN anchor text CHECK (anchor IS NULL OR char_length(anchor) <= 60);
ALTER TABLE learning_journeys ADD COLUMN starter boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX one_starter_journey ON learning_journeys (starter) WHERE starter;
ALTER TABLE learning_journeys ADD CONSTRAINT starter_requires_published CHECK (NOT starter OR status = 'published');
