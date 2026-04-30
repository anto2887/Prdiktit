// src/pages/GroupsPage.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGroups } from '../contexts/AppContext';

// Components
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import OnboardingGuide, { HelpTooltip } from '../components/onboarding/OnboardingGuide';
import { useI18n } from '../i18n';

const GroupsPage = () => {
  const { userGroups, fetchUserGroups, loading, error } = useGroups();
  const { t } = useI18n();
  
  // Guide state
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

  useEffect(() => {
    fetchUserGroups();
  }, [fetchUserGroups]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{t('groups.myLeagues')}</h1>
        <div className="flex items-center gap-4">
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <HelpTooltip content={t('groups.tooltipJoinLeague')}>
              <Link
                to="/groups/join"
                className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 text-center"
              >
                {t('groups.joinLeague')}
              </Link>
            </HelpTooltip>
            <HelpTooltip content={t('groups.tooltipCreateLeague')}>
              <Link
                to="/groups/create"
                className="w-full md:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 text-center"
              >
                {t('groups.createLeague')}
              </Link>
            </HelpTooltip>
          </div>
          <HelpTooltip content={t('groups.tooltipGuide')}>
            <button
              onClick={() => setShowGuide(true)}
              className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </HelpTooltip>
        </div>
      </div>

      {userGroups.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            You&apos;re not in any leagues yet
          </h3>
          <p className="text-gray-500 mb-4">
            {t('groups.emptyStateSubtitle')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userGroups.map(group => (
            <div key={group.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  {group.name}
                </h3>
                <p className="text-sm text-gray-500">
                  {group.league}
                </p>
              </div>
              <div className="px-6 py-4 bg-gray-50">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">
                    {group.member_count} {t('groups.members')}
                  </span>
                  <Link
                    to={`/groups/${group.id}`}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    {t('groups.viewLeague')} →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Guide/Help System */}
      <OnboardingGuide
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        onComplete={() => setShowGuide(false)}
        step={guideStep}
        totalSteps={4}
        steps={[
          {
            title: t('groups.myLeagues'),
            content: t('groups.guideWelcomeContent'),
            action: t('common.next'),
            highlight: null
          },
          {
            title: t('groups.guideJoinTitle'),
            content: t('groups.guideJoinContent'),
            action: t('common.next'),
            highlight: null
          },
          {
            title: t('groups.guideCreateTitle'),
            content: t('groups.guideCreateContent'),
            action: t('common.next'),
            highlight: null
          },
          {
            title: t('groups.guideFeaturesTitle'),
            content: t('groups.guideFeaturesContent'),
            action: t('common.gotIt'),
            highlight: null
          }
        ]}
      />
    </div>
  );
};

export default GroupsPage;