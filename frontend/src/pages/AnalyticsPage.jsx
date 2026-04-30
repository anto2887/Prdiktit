// src/pages/AnalyticsPage.jsx — hub when multiple groups; auto-redirect when one group
import React, { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth, useGroups } from '../contexts/AppContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useI18n } from '../i18n';

const AnalyticsPage = () => {
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const { userGroups, loading: groupsLoading, fetchUserGroups } = useGroups();

  useEffect(() => {
    if (user) fetchUserGroups();
  }, [user, fetchUserGroups]);

  if (authLoading || (user && groupsLoading)) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;

  if (userGroups?.length === 1) {
    return <Navigate to={`/groups/${userGroups[0].id}/analytics`} replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-8">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-lg font-bold text-gray-900">{t('tabs.analytics')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('analytics.pickLeague')}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-3">
        {userGroups?.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <p className="text-gray-600 text-sm mb-4">{t('analytics.joinToUnlock')}</p>
            <Link
              to="/groups/join"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
            >
              {t('analytics.joinGroup')}
            </Link>
          </div>
        ) : (
          userGroups.map((g) => (
            <Link
              key={g.id}
              to={`/groups/${g.id}/analytics`}
              className="block bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:border-indigo-300 hover:shadow transition"
            >
              <div className="font-semibold text-gray-900">{g.name || `${t('analytics.groupLabel')} ${g.id}`}</div>
              {g.league && <div className="text-xs text-gray-500 mt-1">{g.league}</div>}
              <div className="text-sm text-indigo-600 mt-2 font-medium">{t('analytics.viewAnalytics')} →</div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
};

export default AnalyticsPage;
