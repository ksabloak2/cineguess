-- Starter info columns for Most Popular (top250) category
-- oscar_wins = NULL means not yet fetched; 0 = fetched, no wins (from OMDb)
-- oscar_nomination_categories = Wikidata nomination categories (length = true nomination count)
ALTER TABLE movies
  ADD COLUMN IF NOT EXISTS oscar_wins                  INTEGER  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS oscar_nomination_categories TEXT[]   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS franchise_name              TEXT     DEFAULT NULL;

-- If you already ran the old migration with oscar_nominations, rename it:
-- ALTER TABLE movies RENAME COLUMN oscar_nominations TO oscar_wins;
