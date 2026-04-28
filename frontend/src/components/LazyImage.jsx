/**
 * LazyImage — Intersection Observer-based lazy loader.
 *
 * Renders a lightweight placeholder until the image enters the viewport
 * (plus a 200px root-margin buffer so it pre-loads just before appearing).
 * Once visible, swaps in the real <img> with a smooth opacity fade-in.
 *
 * Props:
 *   src        — image URL (passed straight to <img src>)
 *   alt        — alt text
 *   className  — forwarded to the <img> element
 *   style      — forwarded to the wrapper <div>
 *   placeholder — optional JSX shown while the real image is loading
 *                 (defaults to a dark shimmer div matching the wrapper size)
 *   onLoad     — optional callback when the image finishes loading
 */
import { useEffect, useRef, useState } from 'react';

export default function LazyImage({
  src,
  alt = '',
  className = '',
  style = {},
  placeholder,
  onLoad,
  ...rest
}) {
  const wrapperRef = useRef(null);
  const [visible, setVisible]   = useState(false);
  const [loaded,  setLoaded]    = useState(false);

  useEffect(() => {
    if (!src) return;
    const el = wrapperRef.current;
    if (!el) return;

    // If IntersectionObserver isn't supported (rare), just show immediately.
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' } // pre-load 200px before entering viewport
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [src]);

  const defaultPlaceholder = (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 'inherit',
      }}
    />
  );

  return (
    <div ref={wrapperRef} style={{ position: 'relative', overflow: 'hidden', ...style }}>
      {/* Show placeholder until the real image has fully loaded */}
      {!loaded && (placeholder ?? defaultPlaceholder)}

      {visible && src && (
        <img
          src={src}
          alt={alt}
          className={className}
          onLoad={() => { setLoaded(true); onLoad?.(); }}
          {...rest}
          style={{
            ...(rest.style || {}),
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.25s ease',
            // Ensure the img fills its wrapper when used as a cover image.
            width: '100%',
            height: '100%',
            position: loaded ? 'relative' : 'absolute',
            inset: 0,
          }}
        />
      )}
    </div>
  );
}
