import { useEffect } from 'react';

// ── Sign-out confirmation modal ─────────────────────────────────────────────
// Glassmorphism overlay matching the Rules modal language. Prevents
// accidental logouts with a two-button confirm.
export default function SignOutModal({ open, onCancel, onConfirm }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 animate-fade-in"
      onClick={onCancel}
      style={{
        background:           'rgba(5,5,10,0.72)',
        backdropFilter:       'blur(14px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(14px) saturate(1.3)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signout-title"
        className="relative w-full max-w-sm rounded-2xl p-6 sm:p-7 text-center animate-slide-up"
        style={{
          background: 'linear-gradient(180deg, rgba(22,22,28,0.92) 0%, rgba(15,15,20,0.96) 100%)',
          border:     '1px solid rgba(243,206,19,0.22)',
          boxShadow:  '0 20px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 50px rgba(243,206,19,0.06)',
        }}
      >
        {/* Close (redundant with backdrop click, but expected) */}
        <button
          onClick={onCancel}
          aria-label="Close"
          className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center
                     text-gray-500 hover:text-white hover:bg-white/10 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Icon */}
        <div
          className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
          style={{
            background: 'rgba(243,206,19,0.10)',
            border:     '1px solid rgba(243,206,19,0.28)',
            boxShadow:  '0 0 22px rgba(243,206,19,0.18)',
          }}
        >
          <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24"
               stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </div>

        {/* Heading */}
        <h2
          id="signout-title"
          className="font-display text-2xl font-black text-white tracking-tight mb-2"
        >
          Sign Out?
        </h2>

        {/* Body */}
        <p className="text-sm text-gray-400 leading-relaxed mb-6">
          Are you sure you want to end your session?
        </p>

        {/* Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={onCancel}
            autoFocus
            className="w-full py-3 rounded-xl font-bold text-sm font-display tracking-tight
                       transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
            style={{
              background: '#F3CE13',
              color:      '#0a0a0f',
              boxShadow:  '0 0 20px rgba(243,206,19,0.35), inset 0 1px 0 rgba(255,255,255,0.3)',
            }}
          >
            Keep Playing
          </button>
          <button
            onClick={onConfirm}
            className="w-full py-3 rounded-xl font-semibold text-sm
                       text-red-400 hover:text-red-300
                       transition-all duration-200 active:scale-[0.98]"
            style={{
              background: 'rgba(239,68,68,0.06)',
              border:     '1px solid rgba(239,68,68,0.22)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.12)';
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.40)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.06)';
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.22)';
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
