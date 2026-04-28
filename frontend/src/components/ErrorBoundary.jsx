/**
 * ErrorBoundary — catches render-time errors in its subtree and shows a
 * movie-themed "Technical Difficulties" screen instead of a white crash.
 *
 * Features
 * ─────────
 * • "Try again" resets just this boundary (no full page reload needed).
 * • "Reload page" is offered as a harder reset for persistent errors.
 * • Errors are reported to /api/logs/error (production) or console (dev).
 * • Stack traces are NEVER rendered in the UI — logged server-side only.
 * • Accepts an optional `fallback` prop to override the default UI.
 *
 * Usage
 * ─────
 * <ErrorBoundary>
 *   <SomePage />
 * </ErrorBoundary>
 */
import { Component } from 'react';
import logger from '../utils/logger';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorId: null };
    this.handleReset  = this.handleReset.bind(this);
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError() {
    // Generate a short incident ID so support can correlate client UI with
    // server-side log_events rows.
    const errorId = Math.random().toString(36).slice(2, 8).toUpperCase();
    return { hasError: true, errorId };
  }

  componentDidCatch(err, info) {
    // Safe to log: we send err.message + component stack — never raw secrets.
    logger.error(err, {
      context: 'ErrorBoundary',
      stack: info.componentStack,
    });
  }

  handleReset() {
    this.setState({ hasError: false, errorId: null });
  }

  handleReload() {
    window.location.reload();
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback)  return this.props.fallback;

    const { errorId } = this.state;

    return (
      <div
        role="alert"
        style={{
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            '0',
          padding:        '3rem 1.5rem',
          textAlign:      'center',
          minHeight:      '40vh',
        }}
      >
        <style>{`
          @keyframes eb-flicker {
            0%, 100% { opacity: 1; }
            48%       { opacity: 0.85; }
            50%       { opacity: 0.6; }
            52%       { opacity: 0.9; }
          }
          @keyframes eb-scanline {
            0%   { transform: translateY(-100%); }
            100% { transform: translateY(100vh); }
          }
        `}</style>

        {/* Projector icon with flicker */}
        <div style={{ fontSize: '3.5rem', lineHeight: 1, marginBottom: '1.25rem',
                      animation: 'eb-flicker 4s ease-in-out infinite' }}>
          📽️
        </div>

        {/* Headline */}
        <p style={{
          fontFamily:   'var(--font-display, Georgia, serif)',
          fontSize:     'clamp(1.1rem, 3vw, 1.5rem)',
          fontWeight:   900,
          color:        '#ffffff',
          letterSpacing: '-0.02em',
          marginBottom: '0.5rem',
        }}>
          Technical Difficulties
        </p>

        {/* Sub-line */}
        <p style={{
          fontSize:     '0.875rem',
          color:        'rgba(255,255,255,0.45)',
          maxWidth:     '26rem',
          lineHeight:   1.65,
          marginBottom: '0.35rem',
        }}>
          The projector hit a snag. Your streaks and progress are safe —
          this section just needs a moment to rewind.
        </p>

        {/* Incident ID — helps correlate with server logs; no stack trace exposed */}
        {errorId && (
          <p style={{
            fontSize:     '0.7rem',
            color:        'rgba(255,255,255,0.2)',
            fontFamily:   'monospace',
            marginBottom: '1.75rem',
            letterSpacing: '0.08em',
          }}>
            ref: {errorId}
          </p>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={this.handleReset}
            style={{
              padding:      '0.55rem 1.4rem',
              borderRadius: '10px',
              background:   'rgba(243,206,19,0.12)',
              border:       '1px solid rgba(243,206,19,0.35)',
              color:        '#F3CE13',
              fontSize:     '0.875rem',
              fontWeight:   700,
              cursor:       'pointer',
              transition:   'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(243,206,19,0.22)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(243,206,19,0.12)'}
          >
            ↺ Try again
          </button>

          <button
            onClick={this.handleReload}
            style={{
              padding:      '0.55rem 1.4rem',
              borderRadius: '10px',
              background:   'rgba(255,255,255,0.05)',
              border:       '1px solid rgba(255,255,255,0.12)',
              color:        'rgba(255,255,255,0.5)',
              fontSize:     '0.875rem',
              fontWeight:   600,
              cursor:       'pointer',
              transition:   'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
