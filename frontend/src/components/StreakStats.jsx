import { useState, useEffect } from 'react';
import { getStreaks } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function StreakStats({ category }) {
  const { session } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!session) return;
    getStreaks(category).then(setData).catch(console.error);
  }, [category, session]);

  if (!session || !data) return null;

  return (
    <div className="flex items-center justify-center gap-8 py-2">
      <div className="text-center">
        <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums">{data.current_streak ?? 0}</p>
        <p className="text-[10px] sm:text-xs text-gray-600 mt-0.5">Current streak</p>
      </div>
      <div className="w-px h-8 bg-surface-border" />
      <div className="text-center">
        <p className="text-2xl sm:text-3xl font-bold text-accent tabular-nums">{data.longest_streak ?? 0}</p>
        <p className="text-[10px] sm:text-xs text-gray-600 mt-0.5">Best streak</p>
      </div>
    </div>
  );
}
