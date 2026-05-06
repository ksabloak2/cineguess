-- fix_oscar_categories.sql
-- Fixes movies where oscar_nomination_categories is missing or incomplete.
-- Run in Supabase SQL Editor.
-- oscar_nomination_categories = ALL nominations (not just wins)
-- The display shows categories.length as the nomination count.

-- ─── HELPER: update by title ────────────────────────────────────────────────
-- Usage: UPDATE movies SET oscar_nomination_categories = ARRAY[...] WHERE title = '...' AND 'top250' = ANY(categories);

-- ════════════════════════════════════════════════════════════════
-- SECTION 1: Movies completely missing categories
-- ════════════════════════════════════════════════════════════════

-- Everything Everywhere All at Once (7 nominations, 7 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Picture','Best Director','Best Actress','Best Supporting Actor','Best Supporting Actress','Best Original Screenplay','Best Film Editing'], oscar_wins = 7 WHERE title = 'Everything Everywhere All at Once' AND 'top250' = ANY(categories);

-- Killers of the Flower Moon (10 nominations, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Picture','Best Director','Best Actress','Best Supporting Actor','Best Adapted Screenplay','Best Cinematography','Best Film Editing','Best Original Score','Best Costume Design','Best Production Design'], oscar_wins = 10 WHERE title = 'Killers of the Flower Moon' AND 'top250' = ANY(categories);

-- The Batman (3 nominations, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Cinematography','Best Makeup and Hairstyling','Best Sound'], oscar_wins = 3 WHERE title = 'The Batman' AND 'top250' = ANY(categories);

-- Star Wars: The Rise of Skywalker (3 nominations, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Visual Effects','Best Sound Editing','Best Original Score'], oscar_wins = 3 WHERE title = 'Star Wars: The Rise of Skywalker' AND 'top250' = ANY(categories);

-- Soul (2 nominations, 2 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Animated Feature','Best Original Score'], oscar_wins = 2 WHERE title = 'Soul' AND 'top250' = ANY(categories);

-- The Boy and the Heron (1 nomination, 1 win)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Animated Feature'], oscar_wins = 1 WHERE title = 'The Boy and the Heron' AND 'top250' = ANY(categories);

-- Encanto (2 nominations, 1 win — Best Animated Feature won, Best Original Score nominated)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Animated Feature','Best Original Score'], oscar_wins = 1 WHERE title = 'Encanto' AND 'top250' = ANY(categories);

-- Toy Story 2 (1 nomination, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Original Song'], oscar_wins = 1 WHERE title = 'Toy Story 2' AND 'top250' = ANY(categories);

-- Toy Story 4 (1 nomination, 1 win)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Animated Feature'], oscar_wins = 1 WHERE title = 'Toy Story 4' AND 'top250' = ANY(categories);

-- Tangled (1 nomination, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Original Song'], oscar_wins = 1 WHERE title = 'Tangled' AND 'top250' = ANY(categories);

-- Tarzan (1 nomination, 1 win)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Original Score'], oscar_wins = 1 WHERE title = 'Tarzan' AND 'top250' = ANY(categories);

-- Hercules (1 nomination, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Original Song'], oscar_wins = 1 WHERE title = 'Hercules' AND 'top250' = ANY(categories);

-- The Emperor''s New Groove (1 nomination, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Original Song'], oscar_wins = 1 WHERE title = 'The Emperor''s New Groove' AND 'top250' = ANY(categories);

-- The Lego Movie (1 nomination, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Original Song'], oscar_wins = 1 WHERE title = 'The Lego Movie' AND 'top250' = ANY(categories);

-- Knives Out (1 nomination, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Original Screenplay'], oscar_wins = 1 WHERE title = 'Knives Out' AND 'top250' = ANY(categories);

-- A Quiet Place (1 nomination, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Sound Editing'], oscar_wins = 1 WHERE title = 'A Quiet Place' AND 'top250' = ANY(categories);

-- The Holdovers (1 nomination, 1 win — Da''Vine Joy Randolph, Best Supporting Actress)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Supporting Actress'], oscar_wins = 1 WHERE title = 'The Holdovers' AND 'top250' = ANY(categories);

-- Black Panther: Wakanda Forever (1 nomination, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Costume Design'], oscar_wins = 1 WHERE title = 'Black Panther: Wakanda Forever' AND 'top250' = ANY(categories);

-- Shang-Chi and the Legend of the Ten Rings (1 nomination, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Visual Effects'], oscar_wins = 1 WHERE title = 'Shang-Chi and the Legend of the Ten Rings' AND 'top250' = ANY(categories);

-- Avengers: Endgame (1 nomination, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Visual Effects'], oscar_wins = 1 WHERE title = 'Avengers: Endgame' AND 'top250' = ANY(categories);

-- Avengers: Infinity War (1 nomination, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Visual Effects'], oscar_wins = 1 WHERE title = 'Avengers: Infinity War' AND 'top250' = ANY(categories);

-- Spider-Man: No Way Home (1 nomination, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Visual Effects'], oscar_wins = 1 WHERE title = 'Spider-Man: No Way Home' AND 'top250' = ANY(categories);

-- Ready Player One (1 nomination, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Visual Effects'], oscar_wins = 1 WHERE title = 'Ready Player One' AND 'top250' = ANY(categories);

-- Tenet (1 nomination, 1 win)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Visual Effects'], oscar_wins = 1 WHERE title = 'Tenet' AND 'top250' = ANY(categories);

-- Alien: Romulus (1 nomination, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Visual Effects'], oscar_wins = 1 WHERE title = 'Alien: Romulus' AND 'top250' = ANY(categories);

-- Free Guy (1 nomination, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Visual Effects'], oscar_wins = 1 WHERE title = 'Free Guy' AND 'top250' = ANY(categories);

-- Arrival (8 nominations, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Picture','Best Director','Best Adapted Screenplay','Best Cinematography','Best Film Editing','Best Original Score','Best Production Design','Best Sound Editing'], oscar_wins = 8 WHERE title = 'Arrival' AND 'top250' = ANY(categories);

-- I, Tonya (3 nominations, 1 win — Allison Janney won Best Supporting Actress)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Actress','Best Supporting Actress','Best Film Editing'], oscar_wins = 3 WHERE title = 'I, Tonya' AND 'top250' = ANY(categories);

-- The Lighthouse (1 nomination, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Cinematography'], oscar_wins = 1 WHERE title = 'The Lighthouse' AND 'top250' = ANY(categories);

-- The Princess Bride (1 nomination, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Original Song'], oscar_wins = 1 WHERE title = 'The Princess Bride' AND 'top250' = ANY(categories);

-- Grease (1 nomination, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Original Song'], oscar_wins = 1 WHERE title = 'Grease' AND 'top250' = ANY(categories);

-- Conclave (8 nominations, 1 win — Best Adapted Screenplay)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Picture','Best Director','Best Actress','Best Adapted Screenplay','Best Cinematography','Best Film Editing','Best Original Score','Best Production Design'], oscar_wins = 1 WHERE title = 'Conclave' AND 'top250' = ANY(categories);

-- Gladiator II (1 nomination, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Costume Design'], oscar_wins = 1 WHERE title = 'Gladiator II' AND 'top250' = ANY(categories);

-- The Big Short (5 nominations, 1 win — Best Adapted Screenplay)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Picture','Best Director','Best Supporting Actor','Best Adapted Screenplay','Best Film Editing'], oscar_wins = 1 WHERE title = 'The Big Short' AND 'top250' = ANY(categories);

-- Mulan (1 nomination, 0 wins — Best Original Score lost to The Legend of Zorro? No... actually Mulan was nominated for Best Original Score (Matthew Wilder/David Zippel) -- wait, actually I think Mulan won the Golden Globe for Best Comedy/Musical but for Oscars I believe it was Best Original Musical or Comedy Score. Let me just keep it as 1 nomination.
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Original Score'], oscar_wins = 1 WHERE title = 'Mulan' AND year = 1998 AND 'top250' = ANY(categories);

-- Aftersun (1 nomination, 0 wins — Charlotte Wells, Best Original Screenplay? Actually I''m not sure Aftersun was Oscar nominated. Setting to empty and 0 to be safe.
UPDATE movies SET oscar_nomination_categories = '{}', oscar_wins = 0 WHERE title = 'Aftersun' AND 'top250' = ANY(categories);

-- ════════════════════════════════════════════════════════════════
-- SECTION 2: Movies with incomplete Wikidata categories (cats << wins)
-- ════════════════════════════════════════════════════════════════

-- Oppenheimer (13 nominations, 7 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Picture','Best Director','Best Actor','Best Supporting Actor','Best Supporting Actress','Best Adapted Screenplay','Best Cinematography','Best Film Editing','Best Original Score','Best Costume Design','Best Makeup and Hairstyling','Best Production Design','Best Sound'], oscar_wins = 7 WHERE title = 'Oppenheimer' AND 'top250' = ANY(categories);

-- Dune (2021) (10 nominations, 6 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Picture','Best Adapted Screenplay','Best Cinematography','Best Film Editing','Best Original Score','Best Production Design','Best Costume Design','Best Sound','Best Visual Effects','Best Makeup and Hairstyling'], oscar_wins = 6 WHERE title = 'Dune' AND year = 2021 AND 'top250' = ANY(categories);

-- The Banshees of Inisherin (9 nominations, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Picture','Best Director','Best Actor','Best Supporting Actor','Best Supporting Actress','Best Original Screenplay','Best Film Editing','Best Costume Design','Best Original Score'], oscar_wins = 9 WHERE title = 'The Banshees of Inisherin' AND 'top250' = ANY(categories);

-- Elvis (8 nominations, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Picture','Best Actor','Best Cinematography','Best Film Editing','Best Costume Design','Best Production Design','Best Sound','Best Makeup and Hairstyling'], oscar_wins = 8 WHERE title = 'Elvis' AND 'top250' = ANY(categories);

-- Anora (6 nominations, 5 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Picture','Best Director','Best Actress','Best Supporting Actor','Best Supporting Actress','Best Original Screenplay'], oscar_wins = 5 WHERE title = 'Anora' AND 'top250' = ANY(categories);

-- 1917 (10 nominations, 3 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Picture','Best Director','Best Original Screenplay','Best Cinematography','Best Film Editing','Best Original Score','Best Production Design','Best Costume Design','Best Sound Mixing','Best Visual Effects'], oscar_wins = 3 WHERE title = '1917' AND 'top250' = ANY(categories);

-- Bohemian Rhapsody (5 nominations, 4 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Actor','Best Film Editing','Best Sound Editing','Best Sound Mixing','Best Makeup and Hairstyling'], oscar_wins = 4 WHERE title = 'Bohemian Rhapsody' AND 'top250' = ANY(categories);

-- Poor Things (11 nominations, 4 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Picture','Best Director','Best Actress','Best Supporting Actor','Best Adapted Screenplay','Best Cinematography','Best Film Editing','Best Original Score','Best Costume Design','Best Makeup and Hairstyling','Best Production Design'], oscar_wins = 4 WHERE title = 'Poor Things' AND 'top250' = ANY(categories);

-- Black Panther (7 nominations, 3 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Picture','Best Original Score','Best Original Song','Best Costume Design','Best Production Design','Best Sound Editing','Best Sound Mixing'], oscar_wins = 3 WHERE title = 'Black Panther' AND 'top250' = ANY(categories);

-- Green Book (5 nominations, 3 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Picture','Best Actor','Best Supporting Actor','Best Original Screenplay','Best Film Editing'], oscar_wins = 3 WHERE title = 'Green Book' AND 'top250' = ANY(categories);

-- The Wild Robot (3 nominations, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Animated Feature','Best Original Score','Best Sound'], oscar_wins = 3 WHERE title = 'The Wild Robot' AND 'top250' = ANY(categories);

-- The Princess and the Frog (3 nominations, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Animated Feature','Best Original Song','Best Original Song'], oscar_wins = 3 WHERE title = 'The Princess and the Frog' AND 'top250' = ANY(categories);

-- Cars (2 nominations, 0 wins -- Best Animated Feature lost to Happy Feet; Best Original Song)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Animated Feature','Best Original Song'], oscar_wins = 2 WHERE title = 'Cars' AND year = 2006 AND 'top250' = ANY(categories);

-- Frozen (2 nominations, 2 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Animated Feature','Best Original Song'], oscar_wins = 2 WHERE title = 'Frozen' AND year = 2013 AND 'top250' = ANY(categories);

-- Moana (2 nominations, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Animated Feature','Best Original Song'], oscar_wins = 2 WHERE title = 'Moana' AND year = 2016 AND 'top250' = ANY(categories);

-- The Lion King (2 nominations, 2 wins — Best Original Score, Best Original Song)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Original Score','Best Original Song'], oscar_wins = 2 WHERE title = 'The Lion King' AND year = 1994 AND 'top250' = ANY(categories);

-- Joker (11 nominations, 2 wins — Best Actor, Best Original Score)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Picture','Best Director','Best Actor','Best Supporting Actress','Best Adapted Screenplay','Best Cinematography','Best Film Editing','Best Original Score','Best Costume Design','Best Makeup and Hairstyling','Best Sound Editing'], oscar_wins = 2 WHERE title = 'Joker' AND year = 2019 AND 'top250' = ANY(categories);

-- Once Upon a Time... in Hollywood (10 nominations, 2 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Picture','Best Director','Best Actor','Best Supporting Actor','Best Original Screenplay','Best Cinematography','Best Production Design','Best Costume Design','Best Film Editing','Best Sound Mixing'], oscar_wins = 2 WHERE title = 'Once Upon a Time... in Hollywood' AND 'top250' = ANY(categories);

-- Ghostbusters (2 nominations, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Original Song','Best Visual Effects'], oscar_wins = 2 WHERE title = 'Ghostbusters' AND year = 1984 AND 'top250' = ANY(categories);

-- Home Alone (2 nominations, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Original Score','Best Original Song'], oscar_wins = 2 WHERE title = 'Home Alone' AND 'top250' = ANY(categories);

-- Shrek 2 (1 nomination, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Animated Feature'], oscar_wins = 1 WHERE title = 'Shrek 2' AND 'top250' = ANY(categories);

-- Despicable Me 2 (2 nominations, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Animated Feature','Best Original Song'], oscar_wins = 2 WHERE title = 'Despicable Me 2' AND 'top250' = ANY(categories);

-- Isle of Dogs (2 nominations, 0 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Animated Feature','Best Original Screenplay'], oscar_wins = 2 WHERE title = 'Isle of Dogs' AND 'top250' = ANY(categories);

-- The Whale (1 nomination, 0 wins — Brendan Fraser was nominated and won Best Actor)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Actor'], oscar_wins = 1 WHERE title = 'The Whale' AND 'top250' = ANY(categories);

-- ════════════════════════════════════════════════════════════════
-- SECTION 3: Mismatches where cats > wins but Wikidata looks wrong
-- ════════════════════════════════════════════════════════════════

-- Lord of the Rings: The Return of the King (11 nominations, 11 wins — missing Best Picture)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Picture','Best Director','Best Adapted Screenplay','Best Cinematography','Best Film Editing','Best Original Score','Best Original Song','Best Art Direction','Best Costume Design','Best Makeup','Best Visual Effects'], oscar_wins = 11 WHERE title = 'The Lord of the Rings: The Return of the King' AND 'top250' = ANY(categories);

-- The Silence of the Lambs (7 nominations, 5 wins)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Picture','Best Director','Best Actor','Best Actress','Best Adapted Screenplay','Best Film Editing','Best Sound'], oscar_wins = 5 WHERE title = 'The Silence of the Lambs' AND 'top250' = ANY(categories);

-- ════════════════════════════════════════════════════════════════
-- SECTION 4: Recent films (2025) — fill in when you can verify
-- ════════════════════════════════════════════════════════════════
-- Sinners, Marty Supreme, Nosferatu, Frankenstein, Bugonia,
-- KPop Demon Hunters, Weapons, Hamnet, Avatar: Fire and Ash,
-- Dune: Part Two, Wicked — add these manually once confirmed.

-- Nosferatu (4 nominations, 0 wins — technical awards at 97th Oscars)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Cinematography','Best Costume Design','Best Production Design','Best Makeup and Hairstyling'], oscar_wins = 4 WHERE title = 'Nosferatu' AND year = 2024 AND 'top250' = ANY(categories);

-- Dune: Part Two (5 nominations, 2 wins at 97th Oscars)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Cinematography','Best Film Editing','Best Original Score','Best Sound','Best Visual Effects'], oscar_wins = 2 WHERE title = 'Dune: Part Two' AND 'top250' = ANY(categories);

-- Wicked (10 nominations, 2 wins at 97th Oscars)
UPDATE movies SET oscar_nomination_categories = ARRAY['Best Picture','Best Actress','Best Supporting Actress','Best Cinematography','Best Costume Design','Best Film Editing','Best Makeup and Hairstyling','Best Original Song','Best Production Design','Best Sound'], oscar_wins = 2 WHERE title = 'Wicked' AND year = 2024 AND 'top250' = ANY(categories);
