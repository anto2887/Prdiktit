// src/pages/GroupAnalyticsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useAuth, useGroups, useNotifications, useLeagueContext } from '../contexts/AppContext';
import SeasonManager from '../utils/seasonManager';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import ContextAwareNavigation from '../components/common/ContextAwareNavigation';
import { useI18n } from '../i18n';

const GroupAnalyticsPage = () => {
  const { t } = useI18n();
  const { groupId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { fetchGroupDetails, currentGroup } = useGroups();
  const { setSelectedSeason, selectedSeason } = useLeagueContext();
  const { showError } = useNotifications();

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const gid = groupId ? parseInt(groupId, 10) : null;

  const resolveWeek = useCallback(() => {
    const w = currentGroup?.current_week;
    if (w != null && Number.isFinite(Number(w))) return Math.max(1, Math.min(40, Number(w)));
    const stored = localStorage.getItem('currentWeek');
    if (stored) return Math.max(1, Math.min(40, parseInt(stored, 10)));
    return 5;
  }, [currentGroup?.current_week]);

  useEffect(() => {
    if (!gid) return;
    fetchGroupDetails(gid).catch(() => {});
  }, [gid, fetchGroupDetails]);

  useEffect(() => {
    if (!currentGroup?.league) return;
    try {
      const s = SeasonManager.getCurrentSeason(currentGroup.league);
      if (s && !selectedSeason) setSelectedSeason(s);
    } catch {
      if (!selectedSeason) setSelectedSeason('2025-2026');
    }
  }, [currentGroup?.league, selectedSeason, setSelectedSeason]);

  useEffect(() => {
    if (!user || !gid || !selectedSeason) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const week = resolveWeek();
        const { analyticsApi } = await import('../api');
        const response = await analyticsApi.getGroupAnalytics(gid, selectedSeason, week);
        const payload = response.data?.data ?? response.data;
        if (!cancelled) setAnalytics(payload);
      } catch (err) {
        process.env.NODE_ENV === 'development' && console.error('Group analytics:', err);
        if (!cancelled) {
          setError(t('analytics.loadFailed'));
          showError(t('analytics.loadFailed'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user, gid, selectedSeason, resolveWeek, showError]);

  if (authLoading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!groupId) return <ErrorMessage message={t('analytics.groupRequired')} />;

  if (loading && !analytics) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  const overall = analytics?.overall_stats || {};
  const patterns = analytics?.prediction_patterns || {};
  const members = analytics?.member_performance || [];
  const weeks = analytics?.weekly_trends || [];

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-8">
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{t('analytics.groupAnalytics')}</h1>
            <p className="text-sm text-gray-500">
              {currentGroup?.name ? `${currentGroup.name} · ` : ''}
              {selectedSeason && (
                <span>
                  {t('global.season')} {SeasonManager.getSeasonForDisplay?.(currentGroup?.league, selectedSeason) || selectedSeason}
                </span>
              )}
            </p>
          </div>
          <Link
            to={`/groups/${groupId}`}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
          >
            ← {t('analytics.backToGroup')}
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-6">
        {gid && (
          <ContextAwareNavigation groupId={gid} currentPath={`/groups/${gid}/analytics`} />
        )}

        {analytics?.generated_at && (
          <p className="text-xs text-gray-400">
            {t('analytics.generated')} {new Date(analytics.generated_at).toLocaleString()}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="text-xs font-medium text-gray-500 uppercase">{t('groupDetails.predictions')}</div>
            <div className="text-2xl font-bold text-gray-900">{overall.total_predictions ?? 0}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="text-xs font-medium text-gray-500 uppercase">{t('analytics.correct1Plus')}</div>
            <div className="text-2xl font-bold text-gray-900">{overall.correct_predictions ?? 0}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="text-xs font-medium text-gray-500 uppercase">{t('analytics.avgPoints')}</div>
            <div className="text-2xl font-bold text-gray-900">{overall.average_points ?? 0}</div>
          </div>
        </div>

        <section className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-base font-semibold text-gray-900">{t('analytics.memberLeaderboard')}</h2>
            <p className="text-xs text-gray-500">{t('analytics.memberLeaderboardDesc')}</p>
          </div>
          <div className="divide-y divide-gray-100">
            {members.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">{t('analytics.noMembersYet')}</div>
            ) : (
              members.map((m, i) => (
                <div
                  key={m.user_id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium text-gray-400 w-6 shrink-0">{i + 1}</span>
                    <span className="font-medium text-gray-900 truncate">{m.username}</span>
                  </div>
                  <div className="text-right shrink-0 text-sm">
                    <span className="font-semibold text-gray-900">{m.total_points} {t('profile.pts')}</span>
                    <span className="text-gray-500 ml-2">
                      {m.prediction_count} {t('analytics.predAbbrev')} · {m.accuracy_percentage}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-2">{t('analytics.predictedOutcomes')}</h2>
          <p className="text-xs text-gray-500 mb-4">{t('analytics.predictedOutcomesDesc')}</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-2xl font-bold text-indigo-600">{patterns.home_wins ?? 0}</div>
              <div className="text-xs text-gray-500">{t('analytics.home')}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-indigo-600">{patterns.away_wins ?? 0}</div>
              <div className="text-xs text-gray-500">{t('analytics.away')}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-indigo-600">{patterns.draws ?? 0}</div>
              <div className="text-xs text-gray-500">{t('analytics.draw')}</div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-base font-semibold text-gray-900">{t('analytics.weeklyTrends')}</h2>
          </div>
          {weeks.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">{t('analytics.noCompletedWeeks')}</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {weeks.map((w) => (
                <li key={w.week} className="px-4 py-2 flex justify-between text-sm">
                  <span className="text-gray-700">{t('rivalries.week')} {w.week}</span>
                  <span className="text-gray-600">
                    {w.total_points} {t('profile.pts')} · {w.prediction_count} {t('analytics.predsAbbrev')} · {t('analytics.avgShort')} {w.average_points}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default GroupAnalyticsPage;
