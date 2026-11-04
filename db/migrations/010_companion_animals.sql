-- Personagem do app: a pessoa escolhe entre cinco animais bíblicos na primeira abertura.
--   sheep  = ovelha/cordeiro (Jo 1:29)       lion   = leão da tribo de Judá (Ap 5:5)
--   dove   = pomba do Espírito (Mt 3:16)      eagle  = águia (Êx 19:4; Is 40:31)
--   donkey = jumentinho da entrada em Jerusalém (Zc 9:9; Mt 21:1-7)
-- NULL = ainda não escolheu (o app pergunta uma vez e, enquanto isso, mostra a ovelha).
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS companion text
  CHECK (companion IS NULL OR companion IN ('sheep','lion','dove','eagle','donkey'));

-- Frases podem valer para todos os animais (animal NULL) ou só para um.
ALTER TABLE companion_phrases ADD COLUMN IF NOT EXISTS animal text
  CHECK (animal IS NULL OR animal IN ('sheep','lion','dove','eagle','donkey'));
DROP INDEX IF EXISTS companion_phrases_cat_idx;
CREATE INDEX IF NOT EXISTS companion_phrases_cat_idx ON companion_phrases (category, animal, enabled, sort_order);

-- As frases-padrão que só fazem sentido para a ovelha (balido, pastar, emoji, "Obrigada") passam a ser só dela.
-- Só altera se o texto ainda for o original (frases editadas no CMS ficam como estão).
UPDATE companion_phrases SET animal = 'sheep'
 WHERE animal IS NULL AND text IN ('Oi, {nome}! Que bom te ver. 🐑', 'Béé! 🐑', 'Obrigada por caminhar comigo!', 'Estou pastando um pouquinho… 🌼');

-- Equivalentes dos outros animais (mesma voz; gênero conforme o animal).
INSERT INTO companion_phrases (category, text, enabled, sort_order, animal)
SELECT v.category, v.text, true, v.ord, v.animal FROM (VALUES
  ('greeting_default', 'Oi, {nome}! Que bom te ver. 🦁', 1, 'lion'),
  ('poke', 'Rrrr… é um rugido de carinho! 🦁', 1, 'lion'),
  ('poke', 'Esforça-te e tem bom ânimo! (Js 1:9)', 8, 'lion'),
  ('thanks', 'Obrigado por caminhar comigo!', 2, 'lion'),
  ('idle', 'Estou deitado no capim, cuidando do campo… 🌾', 2, 'lion'),
  ('idle', 'Os justos são ousados como o leão. (Pv 28:1)', 5, 'lion'),

  ('greeting_default', 'Oi, {nome}! Que bom te ver. 🕊️', 1, 'dove'),
  ('poke', 'Pruu, pruu! 🕊️', 1, 'dove'),
  ('poke', 'Paz para você hoje.', 8, 'dove'),
  ('thanks', 'Obrigada por caminhar comigo!', 2, 'dove'),
  ('idle', 'Estou catando sementinhas… 🌾', 2, 'dove'),
  ('idle', 'Trouxe um raminho de oliveira pra você. 🌿', 5, 'dove'),

  ('greeting_default', 'Oi, {nome}! Que bom te ver. 🦅', 1, 'eagle'),
  ('poke', 'Kiii! 🦅', 1, 'eagle'),
  ('poke', 'Vamos voar alto hoje?', 8, 'eagle'),
  ('thanks', 'Obrigada por caminhar comigo!', 2, 'eagle'),
  ('idle', 'Estou olhando o campo lá de cima… ☁️', 2, 'eagle'),
  ('idle', 'Os que esperam no Senhor renovarão as forças. (Is 40:31)', 5, 'eagle'),

  ('greeting_default', 'Oi, {nome}! Que bom te ver. 🫏', 1, 'donkey'),
  ('poke', 'Ióóó! 🫏', 1, 'donkey'),
  ('poke', 'Hihi, isso faz cócegas na orelha!', 8, 'donkey'),
  ('thanks', 'Obrigado por caminhar comigo!', 2, 'donkey'),
  ('idle', 'Estou pastando um pouquinho… 🌼', 2, 'donkey'),
  ('idle', 'Quem é fiel no mínimo, também é fiel no muito. (Lc 16:10)', 5, 'donkey')
) AS v(category, text, ord, animal)
WHERE NOT EXISTS (SELECT 1 FROM companion_phrases p WHERE p.animal = v.animal);
