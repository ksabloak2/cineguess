/**
 * ReportIssueModal — lets users flag a problem with a movie description,
 * frame, actor credit, or game logic bug.
 *
 * Automatically captures the tmdb_id of whatever movie the user was playing
 * today (read from localStorage) and sends it as hidden context.
 *
 * Usage:
 *   <ReportIssueModal open={open} onClose={() => setOpen(false)} />
 */
import { useEffect, useRef, useState } from 'react';
import { reportIssue } from '../utils/api';

const CATEGORIES = [
  { value: 'movie_description', label: 'Movie description is wrong / too obvious' },
  { value: 'movie_frame',       label: 'Movie frame is incorrect / low quality'   },
  { value: 'actor_credit',      label: 'Actor / credit information is wrong'      },
  { value: 'game_logic',        label: 'Game logic / bug'                         },
  { value: 'other',             label: 'Other'                                    },
];

const MAX_CHARS = 200;

// Scan today's localStorage entries for any active game's movie tmdb_id.
function getActiveMovieId() {
  const today = new Date().toISOString().split('T')[0];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('cineguess_daily_') || !k.endsWith(today)) continue;
      const state = JSON.parse(localStorage.getItem(k));
      const id = state?.movie?.tmdb_id || state?.result?.tmdb_id;
      if (id) return id;
    }
  } catch {}
  return null;
}

export default function ReportIssueModal({ open, onClose }) {
  const [category,    setCategory]    = useState('');
  const [description, setDescription] = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [toast,       setToast]       = useState(null); // 'success' | 'error'
  const selectRef = useRef(null);

  // Lock body scroll + focus select when opened.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => selectRef.current?.focus(), 60);
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Reset form when closed.
  useEffect(() => {
    if (!open) {
      setCategory('');
      setDescription('');
      setSubmitting(false);
      setToast(null);
    }
  }, [open]);

  async function handleSubmit() {
    if (!category || submitting) return;
    setSubmitting(true);
    try {
      await reportIssue({
        category,
        description:  description.trim() || undefined,
        movie_id:     getActiveMovieId() || undefined,
      });
      setToast('success');
      setTimeout(() => { onClose(); }, 2200);
    } catch (err) {
      const msg = err?.response?.data?.error || 'Could not submit. Please try again.';
      setToast(msg);
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const charsLeft = MAX_CHARS - description.length;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        background:           'rgba(5,5,10,0.75)',
        backdropFilter:       'blur(14px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(14px) saturate(1.2)',
      }}
    >
      <div
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 sm:p-7 animate-slide-up sm:animate-bounce-in"
        style={{
          background: 'linear-gradient(180deg, rgba(20,20,28,0.97) 0%, rgba(13,13,20,0.99) 100%)',
          border:     '1px solid rgba(243,206,19,0.18)',
          boxShadow:  '0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center
                     text-gray-500 hover:text-white hover:bg-white/10 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-accent/70 mb-1">
            Feedback
          </p>
          <h2 className="font-display text-xl font-black text-white tracking-tight">
            Report an Issue
          </h2>
          <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
            Spotted something wrong? Let us know — reports are reviewed manually.
          </p>
        </div>

        {/* Success toast overlay */}
        {toast === 'success' ? (
          <div
            className="flex flex-col items-center justify-center gap-3 py-8 animate-fade-in"
            style={{ textAlign: 'center' }}
          >
            <div style={{ fontSize: '2.4rem', lineHeight: 1 }}>✅</div>
            <p className="font-display text-base font-bold text-white">Thank you!</p>
            <p className="text-xs text-gray-400">Your report has been received.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Error banner */}
            {toast && toast !== 'success' && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                ⚠ {toast}
              </div>
            )}

            {/* Category dropdown */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500 mb-1.5">
                Issue type <span className="text-accent/80">*</span>
              </label>
              <select
                ref={selectRef}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full input-field text-sm"
                style={{
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  paddingRight: '36px',
                  cursor: 'pointer',
                }}
              >
                <option value="" disabled>Select a category…</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Description textarea */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500 mb-1.5">
                Additional context <span style={{ textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, MAX_CHARS))}
                placeholder="Describe the issue in a few words…"
                rows={3}
                className="w-full input-field text-sm resize-none"
                style={{ lineHeight: 1.55 }}
              />
              <p
                className="text-right text-[10px] mt-1"
                style={{ color: charsLeft < 20 ? '#f87171' : 'rgba(255,255,255,0.25)' }}
              >
                {charsLeft} remaining
              </p>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!category || submitting}
              className="btn-primary w-full text-sm"
              style={{ marginTop: 2 }}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg style={{ animation: 'spin 0.8s linear infinite' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Submitting…
                </span>
              ) : 'Submit Report'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
