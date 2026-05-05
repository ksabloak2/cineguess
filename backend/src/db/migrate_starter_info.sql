-- Starter info columns for Most Popular (top250) category
-- oscar_nominations = NULL means not yet fetched; 0 = fetched, no nominations
ALTER TABLE movies
  ADD COLUMN IF NOT EXISTS oscar_nominations          INTEGER  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS oscar_nomination_categories TEXT[]  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS franchise_name             TEXT     DEFAULT NULL;
