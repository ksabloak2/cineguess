import { useState, useEffect } from 'react';
import { format, eachDayOfInterval, subDays } from 'date-fns';
import { getCalendar, getStreaks } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function StreakCalendar({ category }) {
  const { session } = useAuth();
  const [calData, setCalData]     = useState([]);
  const [streakData, setStreakData] = useState(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    Promise.all([getCalendar(category), getStreaks(category)])
      .then(([cal, streak]) => { setCalData(cal); setStreakData(streak); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [category, session]);

  if (!session) {
    return (
      <p className="text-xs text-gray-600 text-center mt-2">
        Sign in to track streaks &amp; calendar
      </p>
    );
  }

  if (loading) return null;

  const today = new Date();
  const days = eachDayOfInterval({ start: subDays(today, 29), end: today }).reverse();

  const dayMap = {};
  for (const entry of calData) {
    const key = typeof entry.guess_date === 'string'
      ? entry.guess_date
      : format(new Date(entry.guess_date), 'yyyy-MM-dd');
    dayMap[key] = entry;
  }

  return (
    <div className="mt-4 sm:mt-6">
      {/* Streak stats */}
      {streakData && (
        <div className="flex gap-6 mb-4 justify-center">
          <StatBox label="Current streak" value={streakData.current_streak} />
          <StatBox label="Longest streak" value={streakData.longest_streak} accent />
        </div>
      )}

      {/* Calendar grid */}
      <p className="text-[10px] sm:text-xs text-gray-600 mb-2 text-center font-medium">Last 30 days</p>
      <div className="flex flex-wrap gap-1 justify-center">
        {days.map((day) => {
          const key    = format(day, 'yyyy-MM-dd');
          const entry  = dayMap[key];
          const isToday = key === format(today, 'yyyy-MM-dd');

          let bg = isToday ? 'bg-surface-border/40' : 'bg-black';
          let title = key;
          if (entry?.won === true) {
            bg = 'bg-green-500';
            title = `${key} — Won in ${entry.guesses_taken}`;
          } else if (entry?.won === false) {
            bg = 'bg-red-500';
            title = `${key} — Lost`;
          }

          return (
            <div
              key={key}
              title={title}
              className={`w-5 h-5 sm:w-6 sm:h-6 rounded ${bg} transition-colors
                ${isToday ? 'ring-2 ring-accent/50' : ''}`}
            />
          );
        })}
      </div>

      <div className="flex gap-4 justify-center mt-2.5">
        <Legend color="bg-green-500" label="Won" />
        <Legend color="bg-red-500" label="Lost" />
        <Legend color="bg-black border border-white/10" label="No data" />
      </div>
    </div>
  );
}

function StatBox({ label, value, accent }) {
  return (
    <div className="text-center">
      <p className={`text-xl sm:text-2xl font-bold ${accent ? 'text-accent' : 'text-white'}`}>{value ?? 0}</p>
      <p className="text-[10px] sm:text-xs text-gray-600">{label}</p>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <div className="flex items-center gap-1">
      <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded ${color}`} />
      <span className="text-[9px] sm:text-[10px] text-gray-600">{label}</span>
    </div>
  );
}
