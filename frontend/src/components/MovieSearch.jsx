import { useState, useRef, useEffect, useMemo } from 'react';
import { tmdbImage } from '../utils/api';

// Simple LRU-ish cache — cap at 100 entries to bound memory.
const MAX_QUERY_CACHE = 100;

// Strip all non-alphanumeric characters (punctuation, spaces, hyphens, apostrophes, etc.)
// so "spiderman" matches "Spider-Man", "spider man", "(500)" matches "500", etc.
const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export default function MovieSearch({ movies, onSelect, disabled, alreadyGuessed }) {
  const [query, setQuery]             = useState('');
  const [debouncedQuery, setDebQuery] = useState('');
  const [open, setOpen]               = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef  = useRef(null);
  const inputRef      = useRef(null);
  const queryCache    = useRef(new Map()); // debounced query string → filtered[]
  const debounceTimer = useRef(null);

  const guessedSet = useMemo(() => new Set(alreadyGuessed || []), [alreadyGuessed]);

  // Clear the result cache whenever the underlying movie list or guessed set changes.
  useEffect(() => { queryCache.current.clear(); }, [movies, guessedSet]);

  // Debounce: update debouncedQuery 300ms after the user stops typing.
  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebQuery(query), 300);
    return () => clearTimeout(debounceTimer.current);
  }, [query]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim();
    if (!q) return [];

    const nq = normalize(q);
    if (!nq) return [];

    // Cache hit — same query, same movies, same guessedSet
    if (queryCache.current.has(nq)) return queryCache.current.get(nq);

    // Match against punctuation-stripped title so "spiderman" finds "Spider-Man",
    // "itchapter" finds "It Chapter Two", etc.
    const matches = movies.filter(
      (m) => normalize(m.title).includes(nq) && !guessedSet.has(m.tmdb_id)
    );

    // Titles whose normalized form STARTS WITH the query come first (alphabetical),
    // then titles that merely contain it (also alphabetical).
    const startsWith = matches
      .filter((m) => normalize(m.title).startsWith(nq))
      .sort((a, b) => a.title.localeCompare(b.title));
    const contains = matches
      .filter((m) => !normalize(m.title).startsWith(nq))
      .sort((a, b) => a.title.localeCompare(b.title));

    const results = [...startsWith, ...contains].slice(0, 8);

    // Evict oldest entry when cache is full
    if (queryCache.current.size >= MAX_QUERY_CACHE) {
      const firstKey = queryCache.current.keys().next().value;
      queryCache.current.delete(firstKey);
    }
    queryCache.current.set(nq, results);
    return results;
  }, [debouncedQuery, movies, guessedSet]);

  useEffect(() => {
    function handler(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleKeyDown(e) {
    if (!open || !filtered.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(filtered[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  function handleSelect(movie) {
    onSelect(movie);
    setQuery('');
    setOpen(false);
    setHighlighted(0);
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xl mx-auto">
      <div className="relative group">
        {/* Search icon — left side */}
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 w-4 h-4 pointer-events-none group-focus-within:text-accent transition-colors"
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlighted(0); }}
          // Note: the dropdown results update after a 300ms debounce (debouncedQuery),
          // but the input value (query) updates immediately so typing feels instant.
          onFocus={() => query && setOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={
            disabled
              ? movies && movies.length === 0
                ? 'Loading movies...'
                : 'Game over — come back tomorrow!'
              : 'Search for a movie...'
          }
          className="input-field pl-10 text-sm sm:text-base disabled:opacity-40 disabled:cursor-not-allowed"
          autoComplete="off"
        />
      </div>

      {/* Dropdown */}
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 w-full mt-2 bg-surface-card border border-surface-border rounded-xl
                        shadow-2xl overflow-hidden animate-fade-in">
          {filtered.map((movie, i) => (
            <li
              key={movie.tmdb_id}
              onMouseEnter={() => setHighlighted(i)}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(movie); }}
              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all
                ${i === highlighted ? 'bg-accent/10' : 'hover:bg-surface-input'}`}
            >
              {movie.poster_path ? (
                <img
                  src={tmdbImage(movie.poster_path, 'w92')}
                  alt={movie.title}
                  className="w-8 h-12 object-cover rounded-lg flex-shrink-0 ring-1 ring-white/5"
                />
              ) : (
                <div className="w-8 h-12 bg-surface-border rounded-lg flex-shrink-0 flex items-center justify-center text-sm">🎬</div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{movie.title}</p>
                <p className="text-xs text-gray-600">{movie.year}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {open && query.trim() && filtered.length === 0 && (
        <div className="absolute z-50 w-full mt-2 bg-surface-card border border-surface-border
                        rounded-xl px-4 py-3 text-sm text-gray-500 animate-fade-in">
          No movies found matching &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
}
