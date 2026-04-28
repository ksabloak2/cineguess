/**
 * buildFrameGallery.js
 *
 * Generates backend/public/frames/index.html — a simple scrollable gallery
 * listing every movie with a local trailer-frame set, showing all 10 frames
 * side-by-side so you can eyeball the hint quality.
 *
 * Usage:
 *   node src/scripts/buildFrameGallery.js
 *
 * After running, open:
 *   http://localhost:5000/frames/index.html
 * (backend must be running — Express already serves /frames as static)
 */

require('dotenv').config({ override: true });
const fs   = require('fs');
const path = require('path');
const pool = require('../db/pool');

const FRAMES_DIR = path.join(__dirname, '..', '..', 'public', 'frames');

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function main() {
  const { rows } = await pool.query(
    `SELECT tmdb_id, title, year, categories, backdrop_paths
       FROM movies
      WHERE backdrop_paths IS NOT NULL
        AND cardinality(backdrop_paths) > 0
      ORDER BY title`
  );

  // Include every movie with any backdrop source — trailer frames or TMDB art.
  // The two kinds render differently (local vs image.tmdb.org) and delete
  // through different endpoints, but the UX is the same.
  const withAny = rows.filter((m) => (m.backdrop_paths || []).length > 0);

  function resolveSrc(p) {
    // Trailer-frame JPG served locally, or TMDB path served off image.tmdb.org.
    if (p.startsWith('/frames/') || p.startsWith('http')) return p;
    return `https://image.tmdb.org/t/p/w500${p}`;
  }

  const cards = withAny.map((m) => {
    const paths = m.backdrop_paths || [];
    const hasLocalFrames = paths.some((p) => p.startsWith('/frames/'));
    const kind = hasLocalFrames ? 'frames' : 'tmdb';

    const thumbs = paths
      .map((p, i) => {
        const src = resolveSrc(p);
        // Frame thumbs carry data-file (filename) so DELETE /frames/:filename
        // wipes disk + DB. TMDB thumbs carry data-path (original TMDB path) and
        // data-tmdb so DELETE /dev/backdrop runs array_remove only.
        if (p.startsWith('/frames/')) {
          const filename = p.replace('/frames/', '');
          return `
            <div class="thumb" data-kind="frame" data-file="${escapeHtml(filename)}">
              <img src="${src}" alt="${i}" loading="lazy" />
              <button class="del" title="Delete this frame">×</button>
            </div>
          `;
        }
        return `
          <div class="thumb" data-kind="tmdb" data-tmdb="${m.tmdb_id}" data-path="${escapeHtml(p)}">
            <img src="${src}" alt="${i}" loading="lazy" />
            <button class="del" title="Remove from movie">×</button>
          </div>
        `;
      })
      .join('');
    const cats = (m.categories || []).join(', ');
    const sourceLabel = kind === 'frames' ? 'trailer frames' : 'TMDB backdrops';
    return `
      <section class="movie" data-kind="${kind}">
        <header>
          <h2>${escapeHtml(m.title)} <span class="year">(${m.year || '?'})</span></h2>
          <p class="meta">tmdb_id ${m.tmdb_id} · ${escapeHtml(cats)} · <span class="frame-count">${paths.length}</span> ${sourceLabel}</p>
          <div class="movie-actions">
            <button class="keep-selected" disabled>Keep selected, delete rest</button>
            <button class="clear-selection" disabled>Clear selection</button>
          </div>
        </header>
        <div class="thumbs">${thumbs}</div>
      </section>
    `;
  }).join('');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>CineGuess — Frame Gallery (${withAny.length} movies)</title>
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    background: #0f1115;
    color: #e7e7e7;
  }
  header.page {
    position: sticky; top: 0; z-index: 10;
    padding: 16px 24px;
    background: #0f1115ee;
    backdrop-filter: blur(8px);
    border-bottom: 1px solid #222;
  }
  header.page h1 { margin: 0; font-size: 18px; }
  header.page p  { margin: 4px 0 0; font-size: 12px; color: #888; }
  input#filter {
    margin-top: 8px; width: 320px;
    padding: 6px 10px; font-size: 13px;
    background: #1a1d25; color: #fff;
    border: 1px solid #333; border-radius: 6px;
  }
  main { padding: 16px 24px 64px; }
  section.movie {
    border-top: 1px solid #222;
    padding: 14px 0;
  }
  section.movie h2 { margin: 0; font-size: 15px; }
  section.movie .year { color: #888; font-weight: normal; }
  section.movie .meta { margin: 2px 0 8px; font-size: 11px; color: #666; }
  .thumbs {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 4px;
  }
  .thumb {
    position: relative;
  }
  .thumb img {
    width: 100%; aspect-ratio: 16/9;
    object-fit: cover; border-radius: 3px;
    background: #222;
    cursor: pointer;
    display: block;
  }
  .thumb img:hover { outline: 2px solid #8ab4ff; }
  .thumb.selected img { outline: 3px solid #4ade80; }
  .thumb.selected::after {
    content: '✓';
    position: absolute; top: 4px; left: 4px;
    width: 20px; height: 20px;
    border-radius: 50%;
    background: #4ade80; color: #0f1115;
    font-size: 13px; font-weight: bold;
    display: flex; align-items: center; justify-content: center;
    pointer-events: none;
  }
  section.movie .movie-actions {
    display: flex; gap: 8px; margin: 6px 0 8px;
  }
  section.movie .movie-actions button {
    font-size: 11px; padding: 4px 10px;
    background: #1a1d25; color: #fff;
    border: 1px solid #333; border-radius: 4px;
    cursor: pointer;
  }
  section.movie .movie-actions button:disabled {
    opacity: 0.35; cursor: not-allowed;
  }
  section.movie .movie-actions .keep-selected:not(:disabled):hover {
    background: #c0392b; border-color: #c0392b;
  }
  section.movie .movie-actions .clear-selection:not(:disabled):hover {
    background: #333;
  }
  .thumb .del {
    position: absolute; top: 4px; right: 4px;
    width: 22px; height: 22px;
    border-radius: 50%;
    background: rgba(0,0,0,0.7);
    color: #fff; font-size: 16px; line-height: 1;
    border: 1px solid #555;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s, background 0.15s;
    display: flex; align-items: center; justify-content: center;
    padding: 0;
  }
  .thumb:hover .del { opacity: 1; }
  .thumb .del:hover { background: #c0392b; border-color: #c0392b; }
  .thumb.removing img { opacity: 0.2; }
  @media (max-width: 900px) {
    .thumbs { grid-template-columns: repeat(5, 1fr); }
    .thumb .del { opacity: 1; }
  }
</style>
</head>
<body>
<header class="page">
  <h1>CineGuess — Frame Gallery</h1>
  <p>${withAny.length} movies · ${withAny.reduce((n, m) => n + (m.backdrop_paths || []).length, 0)} images total (${withAny.filter((m) => (m.backdrop_paths || []).some((p) => p.startsWith('/frames/'))).length} trailer-sourced, ${withAny.filter((m) => !(m.backdrop_paths || []).some((p) => p.startsWith('/frames/'))).length} TMDB-sourced)</p>
  <input id="filter" placeholder="Filter by title..." />
</header>
<main id="list">
${cards}
</main>
<script src="/frames/gallery.js"></script>
</body>
</html>`;

  // Keep the JS in a separate file — Helmet's default CSP blocks inline scripts.
  const galleryJs = `
const input = document.getElementById('filter');
const sections = [...document.querySelectorAll('section.movie')];
input.addEventListener('input', () => {
  const q = input.value.toLowerCase().trim();
  for (const s of sections) {
    const title = s.querySelector('h2').textContent.toLowerCase();
    s.style.display = !q || title.includes(q) ? '' : 'none';
  }
});

async function deleteFrame(thumb) {
  thumb.classList.add('removing');
  let res;
  if (thumb.dataset.kind === 'tmdb') {
    res = await fetch('/dev/backdrop', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tmdb_id: Number(thumb.dataset.tmdb),
        path: thumb.dataset.path,
      }),
    });
  } else {
    const filename = thumb.dataset.file;
    res = await fetch('/frames/' + encodeURIComponent(filename), { method: 'DELETE' });
  }
  if (!res.ok) {
    thumb.classList.remove('removing');
    throw new Error('HTTP ' + res.status);
  }
  thumb.remove();
}

// Update a movie section's action buttons + frame count based on current selection.
function refreshSection(section) {
  const thumbs    = section.querySelectorAll('.thumb');
  const selected  = section.querySelectorAll('.thumb.selected');
  const keepBtn   = section.querySelector('.keep-selected');
  const clearBtn  = section.querySelector('.clear-selection');
  const countSpan = section.querySelector('.frame-count');
  if (countSpan) countSpan.textContent = thumbs.length;

  const hasSelection = selected.length > 0;
  const canDeleteRest = hasSelection && selected.length < thumbs.length;
  keepBtn.disabled  = !canDeleteRest;
  clearBtn.disabled = !hasSelection;
  keepBtn.textContent = canDeleteRest
    ? 'Keep ' + selected.length + ', delete other ' + (thumbs.length - selected.length)
    : 'Keep selected, delete rest';
}

document.addEventListener('click', async (e) => {
  // × button → single-frame delete
  if (e.target.classList.contains('del')) {
    e.stopPropagation();
    const thumb = e.target.closest('.thumb');
    if (!thumb) return;
    const filename = thumb.dataset.file;
    if (!confirm('Delete this frame permanently?\\n' + filename)) return;
    const section = thumb.closest('section.movie');
    try {
      await deleteFrame(thumb);
      if (section) refreshSection(section);
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
    return;
  }

  // "Keep selected, delete rest" button
  if (e.target.classList.contains('keep-selected')) {
    const section = e.target.closest('section.movie');
    if (!section) return;
    const toDelete = [...section.querySelectorAll('.thumb:not(.selected)')];
    if (!toDelete.length) return;
    if (!confirm('Delete ' + toDelete.length + ' unselected frame(s) for this movie?')) return;
    let failed = 0;
    for (const thumb of toDelete) {
      try { await deleteFrame(thumb); }
      catch (err) { failed++; console.error(err); }
    }
    // Kept frames lose their selected state afterward.
    section.querySelectorAll('.thumb.selected').forEach((t) => t.classList.remove('selected'));
    refreshSection(section);
    if (failed) alert(failed + ' delete(s) failed — see console.');
    return;
  }

  // "Clear selection" button
  if (e.target.classList.contains('clear-selection')) {
    const section = e.target.closest('section.movie');
    if (!section) return;
    section.querySelectorAll('.thumb.selected').forEach((t) => t.classList.remove('selected'));
    refreshSection(section);
    return;
  }

  // Click image → toggle selection. Shift-click (or Cmd-click) opens full-size instead.
  if (e.target.tagName === 'IMG') {
    if (e.shiftKey || e.metaKey) {
      window.open(e.target.src, '_blank');
      return;
    }
    const thumb = e.target.closest('.thumb');
    if (!thumb) return;
    thumb.classList.toggle('selected');
    const section = thumb.closest('section.movie');
    if (section) refreshSection(section);
  }
});
`;

  const outPath = path.join(FRAMES_DIR, 'index.html');
  fs.writeFileSync(outPath, html);
  fs.writeFileSync(path.join(FRAMES_DIR, 'gallery.js'), galleryJs);
  console.log(`\nWrote ${outPath}`);
  console.log(`${withAny.length} movies in gallery.\n`);
  const port = process.env.PORT || 3001;
  console.log(`Open: http://localhost:${port}/frames/index.html (backend must be running)\n`);

  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
