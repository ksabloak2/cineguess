import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { getYearCalendar } from '../utils/api';
import { CATEGORIES, getMaxGuesses } from '../utils/gameLogic';

const DAILY_CATS = CATEGORIES.filter((c) => c.id !== 'unlimited');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const QUARTER_RANGES = [
  [0, 1, 2],   // Q1
  [3, 4, 5],   // Q2
  [6, 7, 8],   // Q3
  [9, 10, 11], // Q4
];

const QUARTER_LABELS = ['Q1 · Jan – Mar', 'Q2 · Apr – Jun', 'Q3 · Jul – Sep', 'Q4 · Oct – Dec'];

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeDate(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') return raw.slice(0, 10);
  return ymd(new Date(raw));
}

export default function YearCalendar({ fetcher }) {
  const today        = new Date();
  const currentYear  = today.getFullYear();
  const currentQtr   = Math.floor(today.getMonth() / 3);
  const currentMonth = today.getMonth();

  const [year, setYear]       = useState(currentYear);
  const [quarter, setQuarter] = useState(currentQtr);
  // Mobile: index (0-2) of which month within the current quarter is shown
  const [mobileMthIdx, setMobileMthIdx] = useState(
    () => QUARTER_RANGES[currentQtr].indexOf(currentMonth) >= 0
      ? QUARTER_RANGES[currentQtr].indexOf(currentMonth)
      : 0
  );
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  // Reload when year changes (we fetch the whole year and slice by quarter client-side)
  useEffect(() => {
    setLoading(true);
    const load = fetcher || getYearCalendar;
    load(year)
      .then(setRows)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [year, fetcher]);

  const byDay = useMemo(() => {
    const map = {};
    for (const r of rows) {
      const key = normalizeDate(r.guess_date);
      if (!key) continue;
      if (!map[key]) map[key] = { byCat: {}, anyWon: false, anyPlayed: false, allWon: false };
      map[key].byCat[r.category] = r;
      map[key].anyPlayed = true;
      if (r.won) map[key].anyWon = true;
    }
    for (const key of Object.keys(map)) {
      const d = map[key];
      d.allWon = DAILY_CATS.every((c) => d.byCat[c.id]?.won);
    }
    return map;
  }, [rows]);

  const todayKey = ymd(today);

  function prevQuarter() {
    if (quarter === 0) { setYear((y) => y - 1); setQuarter(3); }
    else setQuarter((q) => q - 1);
    setMobileMthIdx(0);
  }

  function nextQuarter() {
    if (quarter === 3) { setYear((y) => y + 1); setQuarter(0); }
    else setQuarter((q) => q + 1);
    setMobileMthIdx(0);
  }

  // Mobile: navigate one month at a time, crossing quarter/year boundaries naturally
  function prevMonth() {
    if (mobileMthIdx > 0) {
      setMobileMthIdx((i) => i - 1);
    } else {
      // Cross into previous quarter
      if (quarter === 0) { setYear((y) => y - 1); setQuarter(3); }
      else setQuarter((q) => q - 1);
      setMobileMthIdx(2);
    }
  }

  function nextMonth() {
    if (mobileMthIdx < 2) {
      setMobileMthIdx((i) => i + 1);
    } else {
      // Cross into next quarter
      if (quarter === 3) { setYear((y) => y + 1); setQuarter(0); }
      else setQuarter((q) => q + 1);
      setMobileMthIdx(0);
    }
  }

  const activeMobileMonthIdx = QUARTER_RANGES[quarter][mobileMthIdx];
  const atFuture = year > currentYear || (year === currentYear && quarter >= currentQtr);
  const atFutureMobile = year > currentYear ||
    (year === currentYear && activeMobileMonthIdx >= currentMonth);

  return (
    <div className="space-y-4">
      {/* ── Mobile nav: one month at a time ── */}
      <div className="flex sm:hidden items-center justify-between gap-2">
        <button
          onClick={prevMonth}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-input hover:bg-surface-border
                     text-gray-400 hover:text-white transition-all text-xs font-medium"
        >
          ←
        </button>
        <div className="text-center">
          <p className="font-display font-bold text-sm text-white">
            {MONTH_NAMES[activeMobileMonthIdx]}
          </p>
          <p className="text-[10px] text-gray-600">{year}</p>
        </div>
        <button
          onClick={nextMonth}
          disabled={atFutureMobile}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-input hover:bg-surface-border
                     text-gray-400 hover:text-white transition-all text-xs font-medium
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          →
        </button>
      </div>

      {/* ── Desktop nav: one quarter at a time ── */}
      <div className="hidden sm:flex items-center justify-between gap-2">
        <button
          onClick={prevQuarter}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-input hover:bg-surface-border
                     text-gray-400 hover:text-white transition-all text-sm font-medium"
        >
          <span>←</span>
          <span>Prev Quarter</span>
        </button>
        <div className="text-center">
          <p className="font-display font-bold text-base text-white">{QUARTER_LABELS[quarter]}</p>
          <p className="text-xs text-gray-600">{year}</p>
        </div>
        <button
          onClick={nextQuarter}
          disabled={atFuture}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-input hover:bg-surface-border
                     text-gray-400 hover:text-white transition-all text-sm font-medium
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <span>Next Quarter</span>
          <span>→</span>
        </button>
      </div>

      {/* Legend */}
      <div className="flex gap-3 sm:gap-4 justify-center text-[9px] sm:text-[10px] text-gray-600 flex-wrap">
        <Legend color="bg-blue-500" label="Swept all 4" />
        <Legend color="bg-green-500" label="Won ≥ 1" />
        <Legend color="bg-red-500" label="Lost all" />
        <Legend color="bg-black border border-white/10" label="No play" />
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Mobile: single month */}
          <div className="sm:hidden">
            <MonthGrid
              key={activeMobileMonthIdx}
              name={MONTH_NAMES[activeMobileMonthIdx]}
              year={year}
              month={activeMobileMonthIdx}
              byDay={byDay}
              todayKey={todayKey}
              onSelect={setSelected}
            />
          </div>

          {/* Desktop: 3-month quarter grid */}
          <div className="hidden sm:grid grid-cols-3 gap-4">
            {QUARTER_RANGES[quarter].map((mIdx) => (
              <MonthGrid
                key={mIdx}
                name={MONTH_NAMES[mIdx]}
                year={year}
                month={mIdx}
                byDay={byDay}
                todayKey={todayKey}
                onSelect={setSelected}
              />
            ))}
          </div>
        </>
      )}

      {selected && (
        <DayModal
          dateKey={selected}
          entry={byDay[selected]}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function MonthGrid({ name, year, month, byDay, todayKey, onSelect }) {
  const first       = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading     = first.getDay();
  const cells       = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="card p-3 sm:p-4">
      <p className="text-xs sm:text-sm font-semibold text-center text-gray-400 mb-2 sm:mb-3">{name}</p>
      <div className="grid grid-cols-7 gap-[3px] sm:gap-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={`h${i}`} className="text-[8px] sm:text-[9px] text-gray-700 text-center pb-0.5">{d}</div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} />;
          const key   = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const entry = byDay[key];
          let bg = key < todayKey ? 'bg-black hover:bg-neutral-900' : 'bg-surface-border/40 hover:bg-surface-border/80';
          if (entry?.allWon)         bg = 'bg-blue-500/80 hover:bg-blue-500';
          else if (entry?.anyWon)    bg = 'bg-green-500/70 hover:bg-green-500';
          else if (entry?.anyPlayed) bg = 'bg-red-500/70 hover:bg-red-500';
          const isToday   = key === todayKey;
          const clickable = !!entry;
          return (
            <button
              key={key}
              disabled={!clickable}
              onClick={() => onSelect(key)}
              title={key}
              className={`aspect-square rounded-sm text-[8px] sm:text-[9px] text-white/60 flex items-center justify-center
                          transition-colors ${bg} ${isToday ? 'ring-1 ring-accent/70' : ''}
                          ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <div className="flex items-center gap-1">
      <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded ${color}`} />
      <span>{label}</span>
    </div>
  );
}

function DayModal({ dateKey, entry, onClose }) {
  const date = new Date(`${dateKey}T12:00:00`);
  const nice = date.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  // Render into document.body so position:fixed is relative to the viewport,
  // not a transformed ancestor (e.g. FriendsPage wraps the calendar in
  // transform:scale(0.88), which would otherwise break the fixed overlay).
  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="card p-5 sm:p-6 w-full sm:max-w-sm space-y-4 rounded-t-3xl sm:rounded-2xl animate-slide-up sm:animate-bounce-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h3 className="font-display font-bold text-sm sm:text-base">{nice}</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-surface-input flex items-center justify-center
                       text-gray-500 hover:text-white hover:bg-surface-border transition-all text-sm"
          >
            ×
          </button>
        </div>
        <div className="space-y-2">
          {DAILY_CATS.map((cat) => {
            const r = entry?.byCat?.[cat.id];
            return (
              <div key={cat.id} className="bg-surface-bg rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{cat.emoji}</span>
                  <span className="text-xs sm:text-sm font-medium">{cat.label}</span>
                </div>
                {r ? (
                  <div className="text-right">
                    <p className={`text-xs font-semibold ${r.won ? 'text-green-400' : 'text-red-400'}`}>
                      {r.won ? `Won ${r.guesses_taken}/${getMaxGuesses(cat.id)}` : 'Lost'}
                    </p>
                    {r.movie_title && (
                      <p className="text-[10px] text-gray-600">
                        {r.movie_title}{r.movie_year ? ` (${r.movie_year})` : ''}
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] text-gray-700">Not played</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
