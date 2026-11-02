ALTER TABLE bible_passages ADD COLUMN book_code text, ADD COLUMN book_order int;
CREATE INDEX bible_passages_lookup_idx ON bible_passages (translation_id, book_code, chapter, verse_start);
