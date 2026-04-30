import React, { useEffect, useState } from 'react';
import { worldcupApi } from '../api';
import { useI18n } from '../i18n';

const GlobalLeaderboardPage = () => {
  const { t } = useI18n();
  const [season, setSeason] = useState('2026');
  const [status, setStatus] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const [statusRes, leaderboardRes] = await Promise.all([
        worldcupApi.getCanonicalStatus(season),
        worldcupApi.getGlobalLeaderboard(season, 100),
      ]);
      setStatus(statusRes?.data || statusRes?.data?.data || null);
      setRows(leaderboardRes?.data || leaderboardRes?.data?.data || []);
    } catch (e) {
      setError(e?.message || 'Failed to load global leaderboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [season]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('global.title')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            {t('global.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700 dark:text-gray-200">Season</label>
          <input
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="w-28 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {status && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-700 dark:text-gray-200">
          Canonical lock: <span className="font-medium">{status.is_canonical_locked ? 'Locked' : 'Open'}</span>
          {status.canonical_lock_at_utc ? ` | Scheduled lock: ${status.canonical_lock_at_utc}` : ''}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-4 text-sm text-gray-500 dark:text-gray-300">Loading leaderboard...</div>
        ) : rows.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 dark:text-gray-300">
            {t('global.noEntries')}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/40">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Rank</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Points</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Rivalry Wins</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Canonical Group</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {rows.map((row) => (
                <tr key={`${row.user_id}-${row.source_group_id}`}>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{row.rank}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{row.username}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{row.total_points}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{row.rivalry_wins}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{row.source_group_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default GlobalLeaderboardPage;
