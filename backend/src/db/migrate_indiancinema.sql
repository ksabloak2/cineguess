-- ============================================================
-- migrate_indiancinema.sql
--
-- 1. Rename category 'bollywood' → 'indiancinema' in all tables.
-- 2. Remove specific movies from 'superhero' pool.
-- 3. Remove specific movies from 'animated' pool (Disney & Ghibli).
-- 4. Remove specific movies from 'indiancinema' pool (cleanup).
--
-- Run ONCE against the live database:
--   psql $DATABASE_URL -f src/db/migrate_indiancinema.sql
-- ============================================================

BEGIN;

-- ── Step 1: Rename bollywood → indiancinema ─────────────────

UPDATE movies
  SET categories = array_replace(categories, 'bollywood', 'indiancinema')
  WHERE 'bollywood' = ANY(categories);

UPDATE daily_picks  SET category = 'indiancinema'          WHERE category = 'bollywood';
UPDATE used_movies  SET category = 'indiancinema'          WHERE category = 'bollywood';
UPDATE guesses      SET category = 'indiancinema'          WHERE category = 'bollywood';
UPDATE streaks      SET category = 'indiancinema'          WHERE category = 'bollywood';
UPDATE streaks      SET category = 'unlimited_indiancinema' WHERE category = 'unlimited_bollywood';

-- ── Step 2: Remove 'The Losers' (2010) from superhero ───────

UPDATE movies
  SET categories = array_remove(categories, 'superhero')
  WHERE title = 'The Losers' AND year = 2010;

DELETE FROM movies WHERE year = 2010 AND title = 'The Losers'
  AND (categories = '{}' OR categories IS NULL);

-- ── Step 3: Remove specific animated movies ──────────────────

-- Disney films the user removed
UPDATE movies
  SET categories = array_remove(categories, 'animated')
  WHERE (title, year) IN (
    ('The Great Mouse Detective', 1986),
    ('Oliver & Company',          1988),
    ('The Rescuers Down Under',   1990),
    ('Atlantis: The Lost Empire', 2001),
    ('Treasure Planet',           2002)
  );

-- Ghibli films the user removed (try both common English titles)
UPDATE movies
  SET categories = array_remove(categories, 'animated')
  WHERE title ILIKE ANY(ARRAY[
    'Kiki''s Delivery Service',
    'Castle in the Sky',
    'Laputa: Castle in the Sky',
    'The Wind Rises',
    'Porco Rosso',
    'Whisper of the Heart',
    'Nausicaä of the Valley of the Wind',
    'Nausicaa of the Valley of the Wind',
    'The Secret World of Arrietty',
    'Arrietty',
    'The Tale of Princess Kaguya',
    'When Marnie Was There',
    'From Up on Poppy Hill',
    'The Cat Returns',
    'Only Yesterday',
    'Ocean Waves',
    'Pom Poko',
    'Tales from Earthsea',
    'My Neighbors the Yamadas',
    'Earwig and the Witch'
  ]);

DELETE FROM movies
  WHERE (categories = '{}' OR categories IS NULL);

-- ── Step 4: Remove Indian Cinema cleanup titles ──────────────

UPDATE movies
  SET categories = array_remove(categories, 'indiancinema')
  WHERE (title, year) IN (
    ('Chhaava',                     2025),
    ('Lootcase',                    2020),
    ('Dial 100',                    2021),
    ('Uri: The Surgical Strike',    2019),
    ('Zanjeer',                     1973),
    ('Don',                         1978),
    ('Muqaddar Ka Sikandar',        1978),
    ('Amar Akbar Anthony',          1977),
    ('Shaan',                       1980),
    ('Govinda Naam Mera',           2022),
    ('Darlings',                    2022),
    ('Gulabo Sitabo',               2020),
    ('Merry Christmas',             2024),
    ('Selfiee',                     2023),
    ('Adipurush',                   2023),
    ('Kisi Ka Bhai Kisi Ki Jaan',   2023),
    ('Runway 34',                   2022),
    ('Sardar Udham',                2021),
    ('Aradhana',                    1969),
    ('Bobby',                       1973),
    ('Pyaasa',                      1957),
    ('Guide',                       1965),
    ('Lootera',                     2013),
    ('Sam Bahadur',                 2023),
    ('Hum',                         1991),
    ('Kahaani 2',                   2016),
    ('Dabangg 3',                   2019),
    ('Tiger 3',                     2023),
    ('Bhool Bhulaiyaa 3',           2024),
    ('Highway',                     2014),
    ('Haider',                      2014),
    ('Pink',                        2016),
    ('Tumbbad',                     2018),
    ('Baby',                        2015),
    ('Talvar',                      2015),
    ('Article 15',                  2019),
    ('Mughal-E-Azam',               1960),
    ('Mother India',                1957),
    ('NH10',                        2015),
    ('Mission Mangal',              2019),
    ('Chhichhore',                  2019),
    ('Dil Bechara',                 2020),
    ('Roohi',                       2021),
    ('Bell Bottom',                 2021),
    ('JugJugg Jeeyo',               2022),
    ('Dream Girl 2',                2023),
    ('Tu Jhoothi Main Makkaar',     2023)
  );

DELETE FROM movies WHERE categories = '{}' OR categories IS NULL;

-- ── Verification ─────────────────────────────────────────────

SELECT 'bollywood remaining' AS check, COUNT(*) AS count
  FROM movies WHERE 'bollywood' = ANY(categories);

SELECT 'indiancinema count' AS check, COUNT(*) AS count
  FROM movies WHERE 'indiancinema' = ANY(categories);

SELECT 'animated count' AS check, COUNT(*) AS count
  FROM movies WHERE 'animated' = ANY(categories);

SELECT 'superhero count' AS check, COUNT(*) AS count
  FROM movies WHERE 'superhero' = ANY(categories);

COMMIT;
